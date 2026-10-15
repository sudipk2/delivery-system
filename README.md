# SmartBite — Firebase-backed menu management

This version replaces the hardcoded menu array with Firestore. It adds an admin sign-in and menu management UI while retaining the main site design, food images, search/categories, cart, estimated pricing, map, and basic status panel.

## Before you start
This is a foundation for a real service, but it is not yet a complete production food-delivery business: there is no real payment, order persistence, restaurant operations, courier dispatch/live tracking, verified inventory workflow, or server-side order pricing. Do not accept real payments or promise delivery until those parts are built and tested.

## 1. Create Firebase project
1. Open https://console.firebase.google.com/ and create a project.
2. In Project settings > General, add a Web app and copy its Firebase config.
3. In Authentication > Sign-in method, enable Email/Password.
4. In Authentication > Users, add the admin account with the email you intend to use. Use a strong unique password.
5. The admin account must have a verified email (`emailVerified == true`). On first sign-in, this website sends a verification email for the allowlisted admin account. Open the link, then sign in again. In Authentication settings, configure your authorized domain if required.
6. Create a Cloud Firestore database.
7. Replace the rules in Firestore > Rules with the contents of `firestore.rules`, replacing `admin@example.com` with the exact admin email.
8. Replace the values in `firebase-config.js` with your web app config and change `adminEmailAllowlist` to the same admin email. Save and publish the rules.

Important: Firebase web config values identify the project; they are not server secrets. Never put service-account keys or private credentials in frontend code. The actual access restriction is enforced by Firestore Security Rules.

## 2. Run the website
Use a local server because this code uses JavaScript modules:
```bash
python3 -m http.server 8000
```
Open http://localhost:8000. Keep the internet on for Firebase CDN modules, remote photos, fonts, and map tiles.

## 3. Add the first menu item
1. Click Admin.
2. Sign in with the verified admin email and password.
3. Fill in the dish form (name, description, price, category, image URL and availability).
4. Click Add dish.
5. The customer menu reads from the same Firestore collection and updates live across open tabs/devices.

## 4. Starter menu
After admin sign-in, click **Import 16 starter dishes** to add the included sample dishes once. This only works when the Firestore `dishes` collection is empty; it never overwrites a menu an admin has already edited. These are example menu items, prices and initial availability, not verified restaurant stock. Review the menu, set real prices and mark availability accurately before making the site public. If you don't want the sample menu, simply add real dishes through the form instead.

## 5. Important production hardening
- Do not use the browser as the source of truth for stock, tax, delivery fee or final order amount. A real checkout must validate all of those on a trusted backend.
- For a public production business, prefer Firebase custom claims assigned through a trusted Admin SDK environment over a frontend email allowlist. The included rules are a reasonable single-admin starting point when the email is fixed and the rules are published correctly.
- Consider Firebase App Check, monitoring, backups, privacy policy, consent, data retention, and abuse controls before public launch.
- Public read access is intentional for menu data. Never store private customer data in `dishes`.
- Images in this version use external URLs. To upload images from the dashboard, add Firebase Storage and Storage Rules.
- Nominatim public reverse-geocoding service has a usage policy; do not send high-volume requests to the public endpoint.
# delivery-system
