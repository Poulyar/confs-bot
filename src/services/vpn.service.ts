import axios from 'axios';
import { logger } from '../utils/logger';

export class VpnService {
    private static api: any;
    private static sessionCookie: string | null = null;

    // Panel Settings (Loaded from Env)
    private static readonly PANEL_URL = process.env.VPN_PANEL_URL;
    private static readonly PANEL_USER = process.env.VPN_PANEL_USERNAME;
    private static readonly PANEL_PASS = process.env.VPN_PANEL_PASSWORD;
    private static readonly INBOUND_ID = parseInt(process.env.VPN_INBOUND_ID || '1', 10);
    private static readonly SERVER_REMARKS = process.env.VPN_SERVER_REMARKS || 'vpn-server';

    private static initialize() {
        if (!this.PANEL_URL || !this.PANEL_USER || !this.PANEL_PASS) {
            logger.warn("VPN_PANEL details are missing from .env. VPN integration will not work.");
            return;
        }

        this.api = axios.create({
            baseURL: this.PANEL_URL,
            timeout: 10000, // 10s timeout
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            withCredentials: true
        });

        // Interceptor to inject the session cookie on every request
        this.api.interceptors.request.use((config: any) => {
            if (this.sessionCookie) {
                config.headers['Cookie'] = this.sessionCookie;
            }
            return config;
        });
    }

    /**
     * Authenticates with the 3X-UI panel and caches the session cookie.
     */
    static async login(): Promise<boolean> {
        this.initialize();

        if (!this.api) return false;

        try {
            logger.info("Connecting to 3X-UI Panel...");
            const response = await this.api.post('/login', {
                username: this.PANEL_USER,
                password: this.PANEL_PASS
            });

            if (response.data.success) {
                const cookies = response.headers['set-cookie'];
                if (cookies && cookies.length > 0) {
                    // Extract the session string (usually `session=XXXX`)
                    this.sessionCookie = cookies[0].split(';')[0];
                    logger.info("Successfully authenticated with 3X-UI Panel.");
                    return true;
                }
            }
            logger.error(`3X-UI Login Failed: ${response.data.msg || 'Unknown Error'}`);
            return false;
        } catch (error: any) {
            logger.error(`3X-UI Login Exception: ${error.message}`);
            return false;
        }
    }

    /**
     * Creates a new client in the specified Inbound.
     * @param email A unique identifier for the user (e.g. user_telegramID_subID)
     * @param limitGb The data limit in GB (0 means unlimited)
     * @param expiryMs The timestamp in milliseconds when the account expires (0 means unlimited)
     */
    static async createClient(email: string, limitGb: number, expiryMs: number): Promise<string | null> {
        // Ensure we are logged in first
        if (!this.sessionCookie) {
            const loggedIn = await this.login();
            if (!loggedIn) throw new Error("Could not log into VPN Panel.");
        }

        try {
            // Convert standard UUID format (3X-UI uses UUIDs as IDs for vless/trojan standard)
            // Generate a secure v4 UUID
            const uuid = crypto.randomUUID();

            // 3X-UI expects data limits in raw bytes
            const totalBytes = limitGb > 0 ? limitGb * 1024 * 1024 * 1024 : 0;

            // Inbound object to inject (3X-UI specific schema)
            const clientData = {
                id: uuid,
                alterId: 0, // Used for Vmess, leave 0 for Vless/Trojan
                email: email,
                limitIp: 2, // Restrict to 2 simultaneous IPs
                totalGB: totalBytes,
                expiryTime: expiryMs,
                enable: true,
                tgId: "",
                subId: crypto.randomUUID() // Separate sub ID for subscription links
            };

            // 3X-UI `addClient` requires sending an array of settings serialized as a string
            const payload = {
                id: this.INBOUND_ID,
                settings: JSON.stringify({ clients: [clientData] })
            };

            console.log("payload", payload)

            const response = await this.api.post('/panel/api/inbounds/addClient', payload);

            if (response.data.success) {
                // Return the formatted connection string (Assuming VLESS for this implementation)
                // You can modify this string format if you use Trojan or VMess instead.
                return `vless://${uuid}@${this.SERVER_REMARKS}:443?type=tcp&security=tls&sni=${this.SERVER_REMARKS}#${email}`;
            } else {
                logger.error(`Failed to add client to 3X-UI: ${response.data.msg}`);
                return null;
            }
        } catch (error: any) {
            // Handle unauthorized - token might have expired
            if (error.response && error.response.status === 401) {
                this.sessionCookie = null; // Clear cookie
                logger.warn("3X-UI Session Expired. Will retry login next time.");
                throw new Error("VPN Session expired. Please try again.");
            }
            logger.error(`3X-UI API Exception on addClient: ${error.message}`);
            throw error;
        }
    }
    /**
     * Fetches live traffic and expiry data for a client from the 3X-UI panel.
     * @param email The client's email identifier on the panel (e.g. "vl-20G7-100")
     * @returns Parsed traffic object or null if unavailable
     */
    static async getClientTraffics(email: string): Promise<{
        remainingGb: number | null;
        expiryDate: Date | null;
        isEnabled: boolean;
    } | null> {
        if (!this.sessionCookie) {
            const loggedIn = await this.login();
            if (!loggedIn) return null;
        }

        try {
            const response = await this.api.get(`/panel/api/inbounds/getClientTraffics/${encodeURIComponent(email)}`);

            if (!response.data.success || !response.data.obj) return null;

            const obj = response.data.obj;

            // Calculate remaining data in GB (total - up - down), rounded to 2 decimals
            // total = 0 means unlimited
            let remainingGb: number | null = null;
            if (obj.total > 0) {
                const usedBytes = (obj.up || 0) + (obj.down || 0);
                const remainingBytes = Math.max(0, obj.total - usedBytes);
                remainingGb = Math.round((remainingBytes / (1024 * 1024 * 1024)) * 100) / 100;
            }

            // Parse expiry time: positive ms timestamp = real date, <=0 = no expiry
            let expiryDate: Date | null = null;
            if (obj.expiryTime > 0) {
                expiryDate = new Date(obj.expiryTime);
            }

            return {
                remainingGb,
                expiryDate,
                isEnabled: obj.enable,
            };
        } catch (error: any) {
            if (error.response?.status === 401) {
                this.sessionCookie = null;
                logger.warn('3X-UI session expired during getClientTraffics.');
            } else {
                logger.error(`getClientTraffics error for ${email}: ${error.message}`);
            }
            return null;
        }
    }

    /**
     * Updates a client's comment on the 3X-UI panel.
     * @param email The client's email identifier on the panel
     * @param trackId The subscription's track ID
     * @param telegramId The user's Telegram ID
     */
    static async updateClientComment(email: string, trackId: string, telegramId: number | string): Promise<boolean> {
        if (!this.sessionCookie) {
            const loggedIn = await this.login();
            if (!loggedIn) return false;
        }

        try {
            // 1. Fetch the inbound to find the client's full object
            const inboundRes = await this.api.get(`/panel/api/inbounds/get/${this.INBOUND_ID}`);
            if (!inboundRes.data.success || !inboundRes.data.obj) {
                logger.warn(`Could not get inbound ${this.INBOUND_ID} to update comment.`);
                return false;
            }

            const inbound = inboundRes.data.obj;
            const settings = JSON.parse(inbound.settings);
            const client = settings.clients.find((c: any) => c.email === email);

            if (!client) {
                logger.warn(`Could not find client ${email} in inbound ${this.INBOUND_ID} to update comment.`);
                return false;
            }

            // 2. Update the comment field
            client.comment = `sub:${trackId}|tg:${telegramId}`;

            // 3. Send the update request
            const payload = {
                id: this.INBOUND_ID,
                settings: JSON.stringify({ clients: [client] })
            };

            const updateRes = await this.api.post(`/panel/api/inbounds/updateClient/${client.id}`, payload);

            if (updateRes.data.success) {
                logger.info(`Successfully updated comment for client ${email}`);
                return true;
            } else {
                logger.error(`Failed to update comment for client ${email}: ${updateRes.data.msg}`);
                return false;
            }
        } catch (error: any) {
            if (error.response?.status === 401) {
                this.sessionCookie = null;
                logger.warn('3X-UI session expired during updateClientComment.');
            } else {
                logger.error(`updateClientComment error for ${email}: ${error.message}`);
            }
            return false;
        }
    }
}
