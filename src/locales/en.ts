export const en = {
    welcome: "Welcome to vPrivate VPN! 🚀\n\nChoose an option below to get started:",
    buy_plan_btn: "🛒 Buy Plan",
    free_trial_btn: "🎁 Free Trial",
    my_subs_btn: "🛡 My Subscriptions",
    profile_btn: "👤 Profile",
    invite_link_btn: "🔗 Generate Invite Link",
    setup_guide_btn: "📚 Setup Guide",
    support_btn: "💬 Support",
    setup_guide_msg: "📚 <b>Setup Guide</b>\n\nYou can find our detailed setup guide for all devices in our official channel:\n\n🔗 https://t.me/+gtGJ0sxhYeVjNmM0",
    support_msg: "💬 <b>Support</b>\n\nIf you have any questions or issues, please contact our support team:\n\n👤 https://t.me/vPrivate_support",
    change_lang_btn: "🌍 Farsi / فارسی",

    // Channel Join
    join_channel_msg: "✋ **Wait! One last step.**\n\nTo use our VPN service, you must first join our official announcement channel. This is where we share important updates and new configs.\n\n1. Join the channel below.\n2. Click the verification button.",
    join_channel_btn: "📢 Join Channel",
    verify_membership_btn: "✅ I JOINED",
    membership_not_found_alert: "❌ Membership not detected! Please join the channel first and then click the button.",
    membership_verified_msg: "🎉 Thank you! Membership verified. You can now use the bot.",

    // Trial
    trial_already_used: "Wait a minute! You have already claimed your free trial.\n\nUse the '🛒 Buy Plan' menu to purchase more data.",
    trial_processing: "🎁 Processing your free trial request...",
    trial_success: "🎉 *Free Trial Activated!*\n\nWelcome to our VPN service! You now have a 10-minute connection with 200MB data limit.\n\n📥 **Import the attached config file** into your VPN client app.\n\nYou can always view your active connections and remaining data inside the **🛡 My Subscriptions** menu.",
    trial_no_configs: "⚠️ Sorry, we've run out of free trial configurations at the moment. Please try again later or contact support.",
    trial_plan_not_found: "⚠️ Sorry, there is no free trial plan available at the moment. Please check back later.",

    // Misc
    unlimited: "Unlimited",
    generic_error: "Sorry, an error occurred. Please try again later.",

    // Auth & Profile
    choose_language_first: "Please select your language / لطفاً زبان خود را انتخاب کنید",
    profile_text: "👤 *Your Profile*\n\nID: `{{id}}`\nRole: {{role}}\nLanguage: {{lang}}\n\nUse the buttons below to change your settings:",

    // Plans
    no_plans_avail: "There are currently no active plans to purchase. Please check back later.",
    select_plan: "Please select a plan from the options below:",

    // Subs
    no_subs_yet: "You don't have any subscriptions yet. Click '🛒 Buy Plan' to get started.",
    here_are_subs: "Here are your subscriptions. Click on one to view details:",

    // Invites
    invite_generating: "Generating your unique invite link...",
    invite_success: "Here is your invite link:\n\n🔗 <a href=\"{{link}}\">{{link}}</a>\n\n<i>Note: This link can only be used by one person.</i>",
    invite_error: "Failed to generate invite. Please try again later.",

    // Coupons - Admin
    admin_unauthorized: "You do not have permission to use this command.",
    admin_panel_title: "Admin Panel Flow:\n\nSelect an administration wizard:",
    admin_invites_generated: "Generated {{count}} invitation codes:\n\n{{codes}}",
    admin_invites_failed: "Failed to generate codes.",
    admin_approve_success: "✅ *Approved: Track ID {{trackId}}*\nHash has been verified and user notified.",
    admin_reject_success: "❌ *Rejected: Track ID {{trackId}}*\nTransaction was rejected and user notified.",
    admin_approve_user_dm: "🎉 *Payment Approved!*\n\nYour transaction ({{trackId}}) has been verified.\n\nYou can also find this config in '🛡 My Subscriptions'.",
    admin_reject_user_dm: "🚫 *Payment Rejected*\n\nYour transaction ({{trackId}}) could not be verified by our team. If you believe this is an error, please contact support and provide your hash.",

    admin_coupon_btn: "🎫 Generate Coupon",
    admin_pending_btn: "⏳ Review Pending Subs",
    admin_coupon_percent: "Enter discount percentage (e.g., 20) or type /cancel:",
    admin_coupon_hours: "Enter expiry time in hours (e.g., 24) or type /cancel:",
    admin_coupon_success: "🎉 Coupon created!\nCode: `{{code}}`\nDiscount: {{percent}}%\nExpires In: {{hours}} hours.",
    admin_coupon_invalid: "Invalid input. Please enter a valid number.",
    admin_no_pending: "There are no pending subscriptions to review.",
    admin_pending_title: "🔥 *Pending Approval*",
    admin_pending_user: "👤 *User ID:* `{{id}}` (@`{{username}}`)",
    admin_pending_plan: "📦 *Plan:* `{{planName}}` (${{amount}})",
    admin_pending_network: "🌐 *Network:* `{{network}}`",
    admin_pending_track: "🧾 *Track ID:* `{{trackId}}`",
    admin_pending_hash: "🔗 *Hash:* {{hash}}",
    admin_pending_submitted: "Submitted around: {{date}}",
    admin_pending_approve: "✅ Approve",
    admin_pending_reject: "❌ Reject",

    // Coupons - Checkout
    checkout_apply_coupon_btn: "🎫 Apply Coupon",
    checkout_enter_coupon: "Please enter your coupon code or type /cancel:",
    checkout_coupon_applied: "🎉 Coupon applied! Discount: {{percent}}%\nNew Price: ${{price}}",
    checkout_invalid_coupon_code: "❌ Invalid coupon code. Please try again or type /cancel.",
    checkout_CouponNotFound: "❌ Coupon not found.",
    checkout_CouponAlreadyUsed: "❌ This coupon has already been used.",
    checkout_CouponExpired: "❌ This coupon has expired.",
    checkout_CouponNotForUser: "❌ This coupon is not assigned to you.",
    checkout_error_no_plan: "Error: No plan selected. Please try again.",
    checkout_error_plan_not_found: "Error: Plan not found.",
    checkout_cancel_btn: "❌ Cancel",
    checkout_step1_text: "You selected: *{{planName}}*\nPrice: *${{price}} USDT*\n\nPlease select your preferred network for payment:",
    checkout_coupon_cancelled: "Coupon entry cancelled. Please select a network to continue.",
    checkout_100_discount: "🎉 *100% Discount Applied!* Generating your subscription instantly...",
    checkout_free_success: "✅ *Subscription Activated!*\n\nYour 100% discount was successfully redeemed.\n\n*Your Connection Config:*\n`{{config}}`\n\nYou can also find this link in '🛡 My Subscriptions'.",
    checkout_free_error: "❌ Internal error generating your subscription. Please contact support and mention coupon code {{code}}.",
    checkout_select_network: "Please select your preferred network for payment (${{price}} USDT):",
    checkout_click_network_btn: "Please click one of the network buttons.",
    checkout_checkout_cancelled: "Checkout cancelled.",
    checkout_invalid_network: "Invalid network selection.",
    checkout_payment_instructions: "🏦 *Payment Instructions*\n\n*Track ID:* `{{trackId}}`\n\nPlease send exactly *${{price}} USDT* via *{{network}}* network to the following address:\n\n`{{wallet}}`\n\n_Tap the address above to copy it._\n\n⏳ Once you have sent the payment, please **reply to this message** with your **Transaction ID (TXID) / Hash**.",
    checkout_send_txid: "Please send your Transaction ID (TXID) as text.",
    checkout_session_expired: "Session expired. Missing user or plan.",
    checkout_txid_recorded: "✅ *Payment Received & Recorded!*\n\nThank you. We have securely saved your TXID:\n`{{txid}}`\n\nYour payment (`{{trackId}}`) is now **Processing**. Once an admin verifies the hash (or it auto-confirms), your VPN configuration will be delivered here automatically.",
    checkout_txid_exists: "❌ That Transaction ID has already been submitted in our system. Please check your TXID and try again.",
    checkout_db_error: "❌ An internal database error occurred while saving your transaction. Please contact support.",

    // Language
    lang_changed: "✅ Language has been changed to English.",
    lang_error_saving: "Error saving language.",
    lang_error_changing: "Error changing language.",

    // Subscriptions Panel
    sub_not_found: "Subscription not found.",
    sub_back_btn: "🔙 Back to List",
    sub_empty_list: "You don't have any subscriptions yet. Click '🛒 Buy Plan' to get started.",
    sub_list_header: "Here are your subscriptions. Click on one to view details:",
    sub_details_title: "📦 *Subscription Details*\n\n",
    sub_track_id: "*Track ID:* `{{trackId}}`\n",
    sub_plan: "*Plan:* {{planName}}\n",
    sub_status: "*Status:* {{status}}\n",
    sub_data_remaining: "*Data:* {{remaining}}GB remaining\n",
    sub_data_unlimited: "*Data:* Unlimited\n",
    sub_expiry: "*Expires At:* {{date}}\n",
    sub_not_active: "*Expires At:* Upon activation\n",
    sub_config: "\n*Connection Link (Tap to copy):*\n`{{config}}`",
    sub_failed_load: "Failed to load details.",
    sub_get_config_btn: "Get Config",
    sub_renew_btn: "Renew Subscription",
    sub_config_not_found: "Config file not found. Please contact support.",
    sub_config_redownload_caption: "📥 Here is your VPN config file. Import it in your VPN client app.",

    // Admin NPVT Pool
    admin_npvt_btn: "📦 Upload Configs",
    admin_npvt_pool_status: "📦 Config Pool Status:",
    admin_npvt_send_zip: "Please send a .zip file containing your .npvt config files.",
    admin_npvt_select_plan: "Which plan are these configs for?",
    admin_npvt_success: "✅ Uploaded {{count}} config(s) to pool for plan: {{planName}}",
    admin_npvt_no_npvt: "❌ No .npvt files found in the zip.",
    admin_npvt_wrong_file: "❌ Please send a .zip file.",
    admin_npvt_error: "❌ Upload failed. Please try again.",

    // General
    generic_error_fetch_pendings: "Error fetching pending transactions."
};
