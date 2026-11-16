# Website live karne ka tareeqa (A to Z)

Sab se aasaan aur sasta tareeqa: **ek VPS server** jis par website aur API dono chalein.
Database (SQLite) aur photos usi server par rehte hain, aur roz raat backup banta hai.

---

## 0. Live karne se pehle (aap ka kaam, bina code ke)

- [ ] **Domain** khareedein, misaal: `yourstore.pk` (PKNIC reseller) ya `.com` (Namecheap / GoDaddy)
- [ ] **Real products**: admin mein demo products edit ya hide karein, apni photos aur prices lagayein
- [ ] **Policies** apne hisaab se likhein (returns, shipping, privacy): `apps/web/src/app/help/[slug]/page.tsx`
- [ ] **WhatsApp business number**, support phone aur email
- [ ] **Delivery charges**, free delivery limit aur shehron ke delivery din: `apps/api/src/config.ts`
- [ ] Courier account (Leopards / TCS / PostEx / Trax / M&P): tracking number abhi admin mein haath se dalta hai
- [ ] Brand naam mein "MagSafe" na ho; website par "MagSafe-compatible" likha hai (Apple trademark)

## 1. Server lein

- Ubuntu 24.04 VPS, **2 GB RAM**, 2 vCPU, 40 GB+ (Hostinger, DigitalOcean, Contabo, Vultr; taqreeban $5–12 mahana)
- Domain ke DNS mein do **A records** server ke IP par lagayein: `yourstore.pk` aur `api.yourstore.pk` (`www` bhi)

## 2. Server tayyar karein (sirf ek baar)

```bash
# Node 22 + git + Caddy (free SSL) + PM2
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git caddy
sudo npm i -g pm2
```

## 3. Code server par lein

Code GitHub (private repo) par daal dein aur server par clone karein:
```bash
sudo mkdir -p /var/www && sudo chown $USER /var/www && cd /var/www
git clone https://github.com/<aap>/magsafe.git && cd magsafe
npm ci
```
(GitHub nahi chahiye to magsafe folder ko zip karke `scp` se bhej dein. `node_modules`, `.next` aur `data` na bhejein.)

## 4. Settings (.env)

```bash
cp deploy/api.env.production apps/api/.env
cp deploy/web.env.production apps/web/.env.local
nano apps/api/.env        # har khaali value bharein
nano apps/web/.env.local
```
- `JWT_SECRET` aur `WEB_REVALIDATE_SECRET` ke liye: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `REVALIDATE_SECRET` (web) = `WEB_REVALIDATE_SECRET` (api), dono ki value same honi chahiye
- `yourdomain.pk` ko har jagah apne domain se badlein
- Agar koi secret kamzor ya khaali ho to API **start hi nahi hogi** aur batayegi ke kya theek karna hai

## 5. Database + build

```bash
npm run setup -w @magora/api   # tables + phones + demo products + aap ka admin account
npm run build                  # website ka fast production version
```
Agar aap ke PC wala data (products, orders) le jaana hai: PC ki `apps/api/data/store.db` aur `apps/api/uploads/` server par isi jagah copy kar dein, `npm run setup` se pehle.

## 6. Chalayein (24/7)

```bash
pm2 start deploy/ecosystem.config.cjs
pm2 save && pm2 startup        # jo command ye dikhaye woh bhi chalayein (reboot ke baad khud start)
```

## 7. Domain + HTTPS

```bash
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile   # yourdomain.pk → aap ka domain
sudo systemctl reload caddy
```
1–2 minute mein `https://yourstore.pk` khul jayegi, SSL ke saath.

## 8. Roz raat backup

```bash
crontab -e
# ye line add karein (har raat 3 baje):
0 3 * * * cd /var/www/magsafe/apps/api && npm run db:backup >> /var/www/backup.log 2>&1
```
Backups `apps/api/backups/` mein bante hain (aakhri 14 din). Hafte mein ek baar ye folder apne PC ya Google Drive par bhi copy kar lein.

## 9. Live hone ke baad check-list

- [ ] `https://yourstore.pk/admin` par login karein
- [ ] Apne number se ek **test order** dein → admin mein "Confirm COD orders" par aaye → Cancel karein
- [ ] Mobile par site kholein; WhatsApp par link share karke preview dekhein
- [ ] Google Search Console mein `https://yourstore.pk/sitemap.xml` submit karein
- [ ] (Optional) Google Analytics aur Facebook Pixel IDs `apps/web/.env.local` mein daal kar `npm run build && pm2 restart all`

## Update kaise karein (naya feature aaye to)

```bash
cd /var/www/magsafe && git pull && npm ci && npm run build && pm2 restart all
```
Database ki tabdeeliyan API start hote waqt khud lag jati hain.

## Admin password bhool gaye?

```bash
cd /var/www/magsafe/apps/api && npm run admin:password -- you@yourstore.pk NayaPassword123
```
Customer password bhoole to: Admin → Customers → customer kholein → **Reset password** → WhatsApp par bhej dein.
