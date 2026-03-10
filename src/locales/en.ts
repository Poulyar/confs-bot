export const en = {
    welcome: "Welcome to Napster VPN! 🚀\n\nChoose an option below to get started:",
    buy_plan_btn: "🛒 Buy Plan",
    free_trial_btn: "🎁 Free Trial",
    my_subs_btn: "🛡 My Subscriptions",
    profile_btn: "👤 Profile",
    invite_link_btn: "🔗 Generate Invite Link",
    setup_guide_btn: "📚 Setup Guide",
    support_btn: "💬 Support",
    change_lang_btn: "🌍 Farsi / Farsi",

    // Trial
    trial_already_used: "Wait a minute! You have already claimed your 24-hour free trial.\n\nUse the '🛒 Buy Plan' menu to purchase more data.",
    trial_processing: "🎁 Processing your free trial request...",
    trial_success: "🎉 *Free Trial Activated!*\n\nWelcome to our VPN service! You now have a 24-hour connection with {{dataGB}}GB data limit.\n\n*Your Connection Config:*\n`{{config}}`\n\nYou can always view your active connections and remaining data inside the **🛡 My Subscriptions** menu.",

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
    admin_coupon_btn: "🎫 Generate Coupon",
    admin_pending_btn: "⏳ Review Pending Subs",
    admin_coupon_percent: "Enter discount percentage (e.g., 20) or type /cancel:",
    admin_coupon_hours: "Enter expiry time in hours (e.g., 24) or type /cancel:",
    admin_coupon_success: "🎉 Coupon created!\nCode: `{{code}}`\nDiscount: {{percent}}%\nExpires In: {{hours}} hours.",
    admin_coupon_invalid: "Invalid input. Please enter a valid number.",
    admin_no_pending: "There are no pending subscriptions to review.",
    admin_pending_title: "🔥 *Pending Approval*",
    admin_pending_user: "👤 *User ID:* {{id}} (@{{username}})",
    admin_pending_plan: "📦 *Plan:* {{planName}} (${{amount}})",
    admin_pending_track: "🧾 *Track ID:* {{trackId}}",
    admin_pending_hash: "🔗 *Hash:* `{{hash}}`",
    admin_pending_submitted: "_Submitted around {{date}}._",
    admin_pending_approve: "✅ Approve",
    admin_pending_reject: "❌ Reject",

    // Coupons - Checkout
    checkout_apply_coupon_btn: "🎫 Apply Coupon",
    checkout_enter_coupon: "Please enter your coupon code or type /cancel to skip:",
    checkout_coupon_applied: "✅ Coupon applied! You got {{percent}}% off.\nNew price: ${{price}} USDT",
    checkout_invalid_coupon_code: "❌ Invalid or non-existent coupon.",
    checkout_coupon_already_used: "❌ This coupon has already been used.",
    checkout_coupon_expired: "❌ This coupon has expired.",
    checkout_coupon_not_for_user: "❌ This coupon isn't assigned to you.",

    // Lang
    lang_changed: "✅ Language has been changed to English."
};
