# Santa's Local Treats

Customer-facing digital treat booklet for the Hexham Santa experience.

## Architecture

- Static frontend deployed from GitHub/Netlify
- Supabase for campaigns, businesses, offers, booklets and redemptions
- Personal booklet access uses a long random token
- Redemption is enforced server-side/database-side and can only happen once per booklet/offer

This repository is being rebuilt from the original GiftLocal prototype. The old GiftLocal code is intentionally removed; the long-term local-commerce platform can be rebuilt on this foundation later.
