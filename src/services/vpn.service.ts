import { logger } from '../utils/logger';
import * as dotenv from 'dotenv';
import { User, Subscription } from '../database/entities';
import { AppDataSource } from '../database/data-source';

dotenv.config();

const vpnApiUrl = process.env.VPN_API_URL || 'http://localhost:8000';
const vpnApiUser = process.env.VPN_API_USER || 'admin';
const vpnApiPass = process.env.VPN_API_PASS || 'admin';

export class VpnService {
    /**
     * Authenticates with Marzban/VPN Panel and returns access token.
     * Mocked for now until actual panel type is confirmed.
     */
    private static async getToken(): Promise<string> {
        logger.info(`Authenticating to VPN panel at ${vpnApiUrl}`);
        // return axios.post('/admin/token', { ... })
        return 'mock-vpn-token-123';
    }

    /**
     * Creates a new limit-based connection string for a user on the panel
     */
    static async createClient(user: User, byteLimit: number, expiryDate: Date): Promise<{ remoteId: string, link: string }> {
        try {
            const token = await this.getToken();
            logger.info(`Creating VPN client for [User ${user.id}] with limit ${byteLimit} bytes, expiry: ${expiryDate}`);

            // In a real panel like Marzban:
            // const res = await axios.post(`${vpnApiUrl}/api/user`, {
            //   username: `premium_${user.id}_${Date.now()}`,
            //   proxies: { vmess: {}, vless: {} },
            //   inbounds: { vmess: ["VMess TCP", "VMess WS"] },
            //   expire: expiryDate.getTime() / 1000,
            //   data_limit: byteLimit,
            //   data_limit_reset_strategy: "no_reset"
            // }, { headers: { Authorization: `Bearer ${token}` }});

            // return { remoteId: res.data.username, link: res.data.links[0] };

            return {
                remoteId: `premium_${user.id}_${Date.now()}`,
                link: `vless://mock-uuid-for-${user.id}@mock.vpn.server:443?security=tls&encryption=none&headerType=none&type=tcp#Premium_${user.id}`
            };

        } catch (error) {
            logger.error('Failed to create VPN client:', error);
            throw error;
        }
    }

    /**
     * Modifies an existing client (e.g. extending duration or topping up data)
     */
    static async modifyClient(remoteId: string, addByteLimit: number, newExpiryDate: Date): Promise<boolean> {
        try {
            const token = await this.getToken();
            logger.info(`Modifying VPN client [${remoteId}]: Added ${addByteLimit} bytes, New Expiry: ${newExpiryDate}`);
            return true;
        } catch (e) {
            logger.error(`Failed to modify client ${remoteId}`, e);
            return false;
        }
    }

    /**
     * Suspends a client connection because they ran out of data or time
     */
    static async disableClient(remoteId: string): Promise<boolean> {
        try {
            const token = await this.getToken();
            logger.info(`Disabling VPN client [${remoteId}]`);
            // Real API call to mark client status == 'disabled'
            return true;
        } catch (e) {
            logger.error(`Failed to disable VPN client ${remoteId}`, e);
            return false;
        }
    }
}
