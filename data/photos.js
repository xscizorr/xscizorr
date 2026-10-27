// Photos of your cards, linked to cards in the collection by card id.
//
// Each line is either   "card id": "front",   or   "card id": ["front", "back"],
// where front and back are files in images/cards/ (without .jpg). tools/resize-photos.ps1 makes those files.
// Cards with a back get a "Flip" button in their pop-up.
// To find a card's id, open the card on the Collection page: it's in the address bar after "card=".
window.SCIZOR_PHOTOS = {
  // ---- Japanese slabs
  "c62b8415b": ["scizor044", "scizor045"], // Crossing the Ruins (Neo 2) · Holo
  "c72b2532f": ["scizor042", "scizor043"], // CoroCoro Promo
  "c8f457a23": ["scizor054", "scizor054-back"], // Wind from the Sea 75/87 · 1st Edition Holo
  "cbcfad548": ["scizor056", "scizor057"], // Wind from the Sea 75/87 · Unlimited Holo
  "c861667ca": ["scizor058", "scizor059"], // Wind from the Sea 74/87 · 1st Edition Non-Holo
  "c6fdf9b25": ["scizor060", "scizor061"], // Wind from the Sea 74/87 · Unlimited Non-Holo
  "c026b1a21": ["scizor052", "scizor053"], // McDonald's Promo 037/P
  "cde4c44b6": ["scizor068", "scizor069"], // Moonlit Pursuit · 1st Edition
  "cd7e400e9": ["scizor070", "scizor071"], // Moonlit Pursuit · Unlimited
  "c34e12360": ["scizor078", "scizor079"], // Intense Fight in the Sky 4/92 · 1st Edition
  "cd6561c0b": ["scizor076", "scizor077"], // Intense Fight in the Sky 4/92 · Unlimited
  "c1217770a": ["scizor080", "scizor081"], // Reviving Legends 48/80 · 1st Edition Holo
  "caacca308": ["scizor082", "scizor083"], // Reviving Legends 48/80 · 1st Edition Reverse Holo
  "c26fa77d1": ["scizor084", "scizor085"], // Reviving Legends 48/80 · Unlimited Holo
  "c15b659c7": ["scizor009", "scizor010"], // Reviving Legends 48/80 · Unlimited Reverse Holo
  "c00432981": ["scizor086", "scizor087"], // Constructed Deck 8/19 · 1st Edition
  "c8b5c27ae": ["scizor088", "scizor089"], // Constructed Deck 8/19 · Unlimited
  "c1af8bb4e": ["scizor090", "scizor091"], // Cold Flare 39/59 · 1st Edition
  "cb12d584d": ["scizor092", "scizor092-back"], // Cold Flare 39/59 · Unlimited
  "cd320f1f2": ["scizor123", "scizor124"], // Super-Burst Impact 61/95
  "c9a58014e": ["scizor125", "scizor126"], // Rebellion Crash 72/96
  "c3efd292a": ["scizor143", "scizor144"], // Incandescent Arcana 44/68 · Non-Holo
  "c00fe94f2": ["scizor145", "scizor146"], // Incandescent Arcana 44/68 · Reverse Holo
  "c5a48c092": ["scizor139", "scizor140"], // Shiny Treasure ex 129/190
  "c75cd1e38": ["scizor135", "scizor136"], // Ruler of the Black Flame 77/108
  "c2c8a06bf": ["scizor137", "scizor138"], // Ruler of the Black Flame 116/108 · Art Rare
  "cdf357a0c": ["scizor141", "scizor142"], // Shiny Treasure ex 299/190
  "c3b9a783a": ["scizor046", "scizor047"], // Darkness, and to Light (Neo 4) · Dark Scizor
  "c2dd719ce": ["scizor050", "scizor051"], // Rocket's Scizor promo 002/P (Trainers Vol. 12)
  "c028bef2f": ["scizor048", "scizor049"], // VS 13/141 · Bugsy's Scizor 1st Edition
  "c89af8c8a": ["scizor062", "scizor063"], // Rocket Gang Strikes Back 66/84 · 1st Edition
  "c97754c31": ["scizor064", "scizor065"], // Rocket Gang Strikes Back 66/84 · Unlimited
  "cdb4f1e58": ["scizor005", "scizor006"], // Golden Sky, Silvery Ocean 96/106 · 1st Edition (signed by Mitsuhiro Arita)
  "c14d08397": ["scizor066", "scizor067"], // Golden Sky, Silvery Ocean 96/106 · Unlimited
  "c8c9460d2": ["scizor074", "scizor075"], // Gallade Half Deck 1/18 · 1st Edition
  "c709f1c7d": ["scizor072", "scizor073"], // Gallade Half Deck 1/18 · Unlimited
  "c11f03366": ["scizor156", "scizor157"], // Gallade Half Deck test print · 1st Edition (CGC 6)
  "c292cbc3a": ["scizor007", "scizor008"], // Gallade Half Deck test proof · Unlimited
  "c97dbe6f4": ["scizor093", "scizor094"], // Rage of the Broken Heavens 57/80 · 1st Edition
  "cbac2e9bb": ["scizor105", "scizor106"], // Rage of the Broken Heavens 57/80 · Unlimited
  "c41b05bd6": ["scizor097", "scizor098"], // Rage of the Broken Heavens 86/80 · 1st Edition Full Art
  "c36def805": ["scizor109", "scizor110"], // Rage of the Broken Heavens 86/80 · Unlimited Full Art
  "c9833e9c9": ["scizor095", "scizor096"], // Rage of the Broken Heavens 58/80 · 1st Edition M Scizor EX
  "cbff900e6": ["scizor107", "scizor108"], // Rage of the Broken Heavens 58/80 · Unlimited M Scizor EX
  "c99200065": ["scizor101", "scizor102"], // Rage of the Broken Heavens 87/80 · 1st Edition Full Art M Scizor EX
  "c349b11ca": ["scizor111", "scizor112"], // Rage of the Broken Heavens 87/80 · Unlimited Full Art M Scizor EX
  "cd9fb2073": ["scizor103", "scizor104"], // Rage of the Broken Heavens 76/80 · 1st Edition Scizor Spirit Link
  "cc9f783fc": ["scizor113", "scizor114"], // Rage of the Broken Heavens 76/80 · Unlimited Scizor Spirit Link
  "c31fa867f": ["scizor115", "scizor116"], // Champion Road 41/66 · Scizor GX
  "ce3a2a25a": ["scizor117", "scizor118"], // Champion Road 71/66 · Full Art Scizor GX
  "c1b329c15": ["scizor119", "scizor120"], // Champion Road 82/66 · Hyper Rare Scizor GX
  "c2e5973dc": ["scizor121", "scizor122"], // GX Ultra Shiny 233/150
  "c667b098e": ["scizor127", "scizor128"], // Infinity Zone 66/100 · Scizor V
  "cfd038dc0": ["scizor131", "scizor132"], // Infinity Zone 107/100 · Full Art Scizor V
  "c5f2fa27a": ["scizor129", "scizor130"], // Infinity Zone 67/100 · Scizor VMAX
  "cb53010b7": ["scizor133", "scizor134"], // Infinity Zone 113/100 · Hyper Rare Scizor VMAX
  "c8eb9b5f4": ["scizor147", "scizor148"], // Cyber Judge 44/71 · Scizor ex
  "c23b64842": ["scizor149", "scizor150"], // Cyber Judge 89/71 · Super Rare
  "cfdf51acc": ["scizor153", "scizor154"], // Start Deck 100 Battle Collection 492/742 · Holo
  "cef6df316": ["scizor155", "scizor155-back"], // Start Deck 100 Battle Collection 492/742 · Reverse Holo
  "c97cb82eb": ["scizor151", "scizor152"], // PCG Championship Series 2025 Winner 210/SV-P

  // ---- Not in hand yet (black and white until it arrives)
  "ca7fdb8b2": "scizor-30th-145"           // 30th Anniversary 145/113 · SR (on the way)
};
