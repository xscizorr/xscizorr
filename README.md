# xscizorr: Scizor collection website

A website that records every Scizor card ever printed and tracks your collection.

- **Home** (`index.html`): a cover page first (see below), then a scrolling carousel of your cards, overall progress, progress by language and every Scizor artwork.
- **Collection** (`collection.html`): a menu like the one in Pokémon Black and White. "All language masterset" leads to the entire checklist and to every language's page.
- **Entire checklist** (`checklist.html`): every card in every language in one list, laid out like the Google Sheet.
- **Language pages** (`language.html?lang=JA`, one per language): the tracker for that language, on the same Black and White screen. Each has its card stack and progress, search and filters, grid, list and "group by artwork" views, a detail pop-up for each card, and an edit mode for updating your collection.

There is no build step. The site is plain HTML, CSS and JavaScript, so any free static host can serve it.

## Viewing it on your computer

Double-click `index.html`. It opens in your browser and works offline, apart from the fonts.

You can also run a small local web server:

```
powershell -ExecutionPolicy Bypass -File tools\serve.ps1
```

then open http://localhost:8080/.

## Card photos

Your slab scans live in `images/cards/` (1000 px tall) and `images/cards/thumbs/` (small copies for the grid). Full-size scans are far too big for a website, so they're resized first.

To add new photos, for example when you scan another language:

1. Make web-sized copies:
   ```
   powershell -ExecutionPolicy Bypass -File tools\resize-photos.ps1 -Src "C:\Users\sam\Desktop\scans\scizor slabs\german"
   ```
   Add `-Names scizor201,scizor203` to resize only some files. Names are the file names without spaces.
   - For slab backs, add `-NoThumbs` (backs only appear in the card pop-up).
   - For a card that's still on the way, add `-Mono` to make the photo black and white with a vignette.
2. Link each photo to its card in `data/photos.js`, one line per card: `"card id": "front",` or, when you have the back too, `"card id": ["front", "back"],`. Cards with a back get a **Show back** button in their pop-up. To find a card's id, open the card on its language page and look in the address bar after `card=`.

You can also add a photo to a single card from its language page in edit mode. Those photos are stored in your browser until you export the data file.

## Homepage cover

A fresh visit or a reload of the homepage opens on a cover, in the style of zentry.com's intro. The page opens on Scizor red, which turns out to be the logo seen up close: it pulls back to the logo in the middle of the screen. The logo rests there, breathing gently, while the homepage loads, with the percentage under it, and then ENTER takes its place. After ENTER and a little wind-up, the claw opens, chomps twice and opens wide a third time. Then it rushes towards you, into the empty space between its two halves; the jaw breaks away, and the head comes down over you until its red fills the screen again. Finally a window opens in the middle of the red and grows until only the homepage is left. Coming back to the homepage from another page of the site skips it.

- The logo is drawn as shapes (so it's sharp at any size) in the cover's `<svg>` in `index.html`: the head, the jaw, the eye and its slit, in a 600 × 600 grid. Its colours are at the top of `css/cover.css`.
- How long each part takes is `RED`, `APPEAR`, `CHOMP`, `RUSH` and `REVEAL` at the top of `js/cover.js`. The chomping itself (when the claw opens and snaps shut, and how far) is `BITE` there.
- Add `?nocover` to the address (`index.html?nocover`) to skip the cover while you're working on the homepage.
- The code is in `js/cover.js` and `css/cover.css`; the choice of whether to show it is in the `<head>` of `index.html`.

## The Collection page

The Collection page is a menu like the touch screen in Pokémon Black and White: a status bar (with the time), six boxes on grid paper, and a bar along the bottom with a red ✕. Pointing at a box (or reaching it with the keyboard) makes it glow blue and its icon hop, at the same pace as in the game. The boxes sit where the game's do:

| Box | In the game's place of | What it does |
|---|---|---|
| All language masterset | Pokémon | asks how to see it: **Entire checklist** (opens `checklist.html`) or **By language** (a box for every language, with its flag and progress, each linking to that language's page) |
| Gallery | Pokédex | coming soon (says so in the bottom bar) |
| Misc | Bag | coming soon |
| About | Trainer | coming soon |
| Contact | Save | coming soon |
| Play | Options | coming soon |

The ✕ goes back a screen (from the languages to "Entire checklist or by language", from there to the menu), and from the menu to the homepage. `collection.html#masterset` opens straight on the choice between the checklist and the languages, `collection.html#languages` on the languages, and `collection.html#JA` on the languages with that language lit up (the ✕ on a language page uses this).

- The labels, which icon each box has and what it does are `MAIN` (the menu) and `MASTER` (Entire checklist / By language) in `js/collection.js`. The icons are little pixel drawings in `js/ds.js` (`ICONS`: one letter per pixel, coloured by each icon's palette), shared with the entire checklist, along with the status bar's clock.
- The look (colours, the glow, the tab on each box, the hop) is in `css/collection.css`. Everything on the screen is sized in `--u`, a hundredth of the screen's width, so the screen scales as one piece.
- The lettering is the Black and White games' own: [Pokemon B/W](https://fontstruct.com/fontstructions/show/563645) by metax, stored in `assets/fonts/PokemonBW.otf`. It's free to use as long as it's credited (Creative Commons Attribution, `assets/fonts/PokemonBW-LICENSE.txt`); the credit is in the footer of the Collection page and the entire checklist, so keep it there. If you share the font file itself, include its licence and readme. The font only has letters, numbers and basic punctuation (no brackets, dashes, "+" or "·"), so the menu shows "Spanish (Latin America)" as "Latin American Spanish" (`NAMES` in `js/collection.js` and `js/checklist.js`) and puts small square dots between the parts of a line. It's sharpest at 16px (or 32px), where each square of the font is one pixel.
- The flags are in `data/flags.js`. Where a language is printed for several countries, one flag is chosen: English is the United States, Spanish (Latin America) is Mexico, Portuguese is Brazil, Traditional Chinese is China and Simplified Chinese is Taiwan. Change a line to swap one.

## The entire checklist

`checklist.html` is on the same Black and White screen as the Collection menu, a wider one so the table fits; the status bar, the lettering and the boxes stay the menu's size. The bar along the bottom stays on screen as you scroll: it names the card you're pointing at, and its ✕ goes back to "Entire checklist or by language". The screen keeps its own colours in light and dark mode.

At the top, a dark panel has:

- the title and the totals (cards, languages, obtained, in transit, unobtained)
- **progress by language**, like the summary in the Google Sheet: each language's flag, its name, obtained + in transit / total, a bar (obtained in red, in transit in grey) and the share obtained, then the total for every language. The languages are in the sheet's order (`ORDER` in `js/checklist.js`). Polish and Russian have no Scizor cards, so they're struck through, as in the sheet. The grades English and Japanese are collected in ("PSA 9/10", "PSA 10") are `GOAL` there.
- the key

Under it, the table lists every Master Set card in every language, laid out like the Google Sheet, with both of its tabs (ENG / JPN and the other languages) together. Each artwork has its own block: a header row, the artwork and its artist down the left, and one row per card with its name, number, set (with its symbol), card type and a column for each language. A card's status sits in its own language's column, coloured like the sheet's drop-downs:

| Chip | Means |
|---|---|
| PSA 10 (dark green) | obtained, PSA 10 |
| PSA 9 (light green) | obtained, PSA 9 (or obtained with no grade) |
| purple, e.g. PSA 8 | obtained, any other grade |
| Raw (yellow) | obtained raw |
| In transit (brown) | on the way |
| Unobtained (red) | still needed |

Pointing at a card's row turns it the menu's blue; clicking it opens the card on its language's page (a card's notes are there). The list comes from the same data as the rest of the site, so your edits show up here too. The table fits a screen 1440px wide; on a narrower one it scrolls sideways, like the sheet. The code is in `checklist.html`, `js/checklist.js` (the language columns, in the sheet's order, are `COLS` there) and `css/checklist.css`, with the screen itself from `css/collection.css`.

## Language pages

Each language has its own page (`language.html?lang=JA`), on the same Black and White screen as the Collection menu (the wider one the entire checklist uses). The code is in `language.html`, `js/language.js` and `css/language.css`, with the screen itself from `css/collection.css`.

- At the top, a dark panel has the language's flag and name, where it comes in the Collection page's order, buttons for the languages either side with **Entire checklist** between them, how many cards are obtained, and its card stack: each layer's height is that status's share. Clicking a layer, or one of the counts (Obtained, In transit, Unobtained), shows only those cards.
- Under it are the toolbar (grid, list and "group by artwork" views, search, and filters by status and artwork, plus sorting) and every Master Set card in that language. Pointing at a card makes it glow the menu's blue, and the bottom bar names it (set, number and card type). Clicking a card opens its pop-up.
- The bar along the bottom stays on screen as you scroll, and its ✕ goes back to the languages, with this one lit up.
- Inside the screen the site's dark colours are always used, so the page looks the same in light and dark mode; the pop-ups and the edit bar follow the site's light or dark mode.
- The page shows the Master Set only. Cameos no longer have a button, but `language.html?lang=JA#cat=cameo` still lists a language's cameos. Other collectibles (plush, figures and so on) aren't tied to a language, so they aren't listed here.
- The Pokémon Rumble Scizor models aren't shown any more. Their files are still here, unused: `js/scizor-model.js`, `data/models.js` (made by `tools/make-models.ps1`) and `assets/models/`. Delete them if you won't bring the model back.

## Homepage carousel

`data/carousel.js` lists the slabs shown on the homepage, in order. Each line has the image, the text shown when someone clicks it, and (optionally) the card it links to:

```js
{ src: "images/cards/scizor003.jpg", title: "Scizor · Crossing the Ruins (Neo 2)", caption: "PSA 8 · Auto 10", card: "c62b8415b" },
```

Any image works as long as it's resized first (see above). If the list is empty, the carousel shows placeholder slabs made from your graded cards.

## Updating your collection

Editing is only for you. The **Edit** button (top right of a language page) only appears in two places:

- on your own computer: by double-clicking `index.html`, or through `tools/serve.ps1` (http://localhost:8080/)
- on the live site, in a browser you've connected to the site's GitHub repository (see "Editing from the live site" below)

Visitors never see it, and statuses are plain labels they can't change. To check what visitors will see, add `?public` to a page's address, e.g. `language.html?lang=JA&public`. (This is set in `js/core.js`, `OWNER`.)

On any language page, click **Edit**. Edit mode stays on as you move between language pages. In edit mode you can:

- click a card's status pill to cycle it between Unobtained, In transit and Obtained (or open the card and pick one)
- open a card to set its status, or edit its grade, price, release date, notes and photo
- add or delete cards (Master Set, Cameos). New cards start in the page's language, and changing a card's language moves it to that language's page
- drag cards into a new order with **Reorder**
- see the prices you paid and how much you've spent

A status change updates everything that counts it straight away: the language page's percentage, counts and card stack, and, when you open them, the Collection page's languages, the entire checklist (its progress by language, totals and table) and the homepage's progress. A page you already had open in another tab, or come back to with the Back button, loads again to catch up.

On your computer, your edits are saved in **this browser on this computer**. Visitors see them once you publish them to your live website:

1. Click **Save & export** (or **Data & backup**), then **Export site data file**.
2. Replace `data/cards.js` in this folder with the downloaded `cards.js`.
3. Upload the folder to your host again.

Edits made on the live site in a connected browser are published by themselves (below).

**Back up everything** saves your edits and photos as one file, which you can restore on another computer.

## Editing from the live site

With the site on **GitHub Pages**, you can edit right on the live site. Each change is saved into `data/cards.js` in the site's GitHub repository, and GitHub Pages publishes it again, so visitors see it a minute or two later with nothing to upload. Your own browser shows your changes straight away. Every change is a commit in the repository, so its history doubles as an undo list. The code is in `js/github.js`.

Setting it up (once):

1. **Put the site on GitHub.** Make a repository on github.com (for example `xscizorr`) and upload this folder's files to it (**Add file → Upload files**). Include the empty `.nojekyll` file, which tells GitHub Pages to publish the files as they are. You can leave out the `tools/` folder.
2. **Turn on GitHub Pages.** In the repository: **Settings → Pages**, then under "Build and deployment" pick **Deploy from a branch**, branch **main**, folder **/ (root)**, and save. The site appears at `https://yourname.github.io/xscizorr/` after a minute.
3. **Make an access key** that can only change this repository: go to https://github.com/settings/personal-access-tokens/new (Settings → Developer settings → Personal access tokens → Fine-grained tokens).
   - Give it a name and an expiry.
   - Under **Repository access**, choose **Only select repositories** and pick the site's repository.
   - Under **Permissions → Repository permissions**, set **Contents** to **Read and write**.
   - Generate it and copy it.
4. **Connect.** On the live site, open any language page with `&owner` on the end, e.g. `https://yourname.github.io/xscizorr/language.html?lang=EN&owner`. The account and repository are filled in from the address; paste the key and click **Connect**. The page opens again in edit mode.

Do step 4 once in each browser you edit in, such as your phone and your computer. Then use edit mode as usual. The bar under the menu says "Saving to GitHub…" and then "Saved to GitHub". If a save fails (offline, say), it says why, keeps your changes in the browser and saves them with your next change. **Data & backup** shows whether you're connected and has **Disconnect**.

Good to know:

- **Your key:** it's kept only in the browsers you connect, and can only change this one repository. If you lose a device, delete the key on GitHub (same settings page) and make a new one.
- **The newest card list is on GitHub.** After you've edited on the live site, the `data/cards.js` in your folder on this computer is out of date. Before you upload anything else to GitHub, download `data/cards.js` from the repository into this folder first, or don't include it in the upload, so the older file doesn't replace your edits.
- **Other devices:** saves are added on top of whatever is on GitHub at the time, so edits made on another device aren't lost.
- **Visitors may wait a bit:** GitHub Pages can take up to about 10 minutes to reach visitors who opened the site recently, because browsers keep a copy for a while.
- **Photos:** photos you upload in edit mode are saved inside `data/cards.js`, which makes it bigger. Card photos are better added as files (see "Card photos").
- **Your own domain:** if the site isn't at a `github.io` address, fill in `owner` and `repo` under `github` in `data/config.js`.

## Updating the card list from the Google Sheet

The card list was imported from your Google Sheet (both tabs, including the artwork images and set symbols). If you keep using the sheet as your master list, re-import it with:

```
powershell -ExecutionPolicy Bypass -File tools\import-sheet.ps1
```

This rebuilds `data/cards.js`, `assets/art/` and `assets/sets/`. The sheet must stay shared as "anyone with the link can view".

Two things to know:

- Edits you made in the browser are kept, because they're matched to cards by name, language, set, number and type. If you change one of those in the sheet, that card's browser edits no longer match it.
- Re-importing replaces `data/cards.js`. Any edits you previously exported into that file, or saved to it from the live site, are lost unless they're also in the sheet. Pick one place as your master list.

How the sheet's status values are read:

| Sheet value | Website status |
|---|---|
| `PSA 10`, `PSA 9`, `Raw`, `Obtained Raw`, `Obtained PSA` | Obtained (with that grade) |
| `On the way`, `Ordered` | In transit |
| `Unobtained`, `Need`, empty | Unobtained |

## Putting it online

Any static host works. Free options:

- **Netlify Drop** (https://app.netlify.com/drop): drag this folder onto the page.
- **GitHub Pages** or **Cloudflare Pages**: push the folder to a repository and turn on Pages.

You can leave out the `tools/` folder when uploading. To edit from the live site without uploading, use GitHub Pages (see "Editing from the live site").

## Settings

- **Currency** for prices: `data/config.js`, for example `currency: "SGD"`.
- **Light or dark**: the site starts in dark mode. The moon button in the header switches to light mode, and the browser remembers the choice (`js/theme.js` and `js/core.js`).
- **Font**: the site uses [Geist Mono](https://vercel.com/font) by Vercel, a free font loaded from Google Fonts. It's set once in `css/site.css` (`--display`, `--body` and `--mono`). The homepage heading ("XSCIZORR") uses [Russo One](https://fonts.google.com/specimen/Russo+One), also free from Google Fonts, set in `css/home.css`. The Collection menu, the entire checklist and the language pages use the Pokémon Black and White lettering (see "The Collection page").
- **Wordmark font**: "xscizorr" in the footer uses Benzol by Malte Grajewski, stored in `assets/fonts/Benzol.otf`. Its licence (`assets/fonts/Benzol-LICENSE.txt`) is personal, non-commercial use only. If the site ever makes money (sales, ads, sponsorships), buy the $2.99 commercial licence first.
- **Metallic crimson**: "xscizorr", the homepage heading, the homepage's big percentage and the obtained parts of its progress bars share Scizor's metallic crimson, `--crimson-metal` in `css/site.css` (bands of highlight and shadow, one set for light mode and one for dark). `--crimson` beside it is the same red as one flat colour.
- **Page transition**: moving between pages plays an animated transition (set up at the bottom of `css/site.css`, under "page transition"). Between the pages on the Black and White screen (the Collection page, the entire checklist and the language pages), the pages cross-fade quickly instead, like the game's screens. It uses the browser's built-in cross-page View Transitions, which work in Chrome, Edge and Safari 18.2+ when the site is online or running through `tools/serve.ps1`. In other browsers (or if the browser skips a transition), `js/page-transition.js` plays the same dim-and-open transition itself, so going back to the homepage animates too.
- **Menu links**: clicking the logo at the left of the menu goes home. The logo is `assets/icons/xscizorr.svg` (the same claw as the homepage cover). The browser tab's icon, `assets/icon.svg`, is the same claw in a square. The menu (Collection, Instagram, PSA Set Registry, Elite Fourum) is in the `<header>` of `index.html`, `collection.html`, `checklist.html` and `language.html`, so change a link in all four files. Instagram, PSA Set Registry and Elite Fourum are logo-only links. The Elite Fourum logo is `assets/icons/elitefourum.svg`; the Instagram and PSA logos are drawn inline in the header.

## Files

```
index.html            homepage
collection.html       the Collection menu (like Pokémon Black and White's)
checklist.html        the entire checklist: every card in every language, like the Google Sheet
language.html         a language's page (the tracker), e.g. language.html?lang=JA
css/                  styles (site.css is shared)
js/core.js            data layer: card list, browser edits, photos, export
js/home.js            carousel and homepage sections
js/scizor-model.js    draws the Pokémon Rumble Scizor (no longer used)
js/collection.js      the Collection page
js/checklist.js       the entire checklist
js/ds.js              the pixel icons and clock shared by the Black and White screen's pages
js/language.js        language pages
js/github.js          editing from the live site: saves your edits into data/cards.js on GitHub
data/cards.js         the card list (generated or exported)
data/carousel.js      the slabs shown in the homepage carousel
data/models.js        the Scizor models as triangles, made by tools/make-models.ps1 (no longer used)
data/flags.js         each language's flag
data/photos.js        which photo belongs to which card
data/config.js        settings
assets/art/           artwork images from the sheet
assets/sets/          set symbols from the sheet
assets/models/        the Pokémon Rumble Scizor models (normal and Mega) and their textures (no longer used)
images/cards/         your card / slab photos (web-sized) and thumbs/
tools/                import-sheet.ps1, resize-photos.ps1, make-models.ps1 and serve.ps1
```
