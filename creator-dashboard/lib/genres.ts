// Canonical genre list and a keyword matcher for free-text niche answers ("Lifestyle, beauty and fashion").
export const GENRES = [
  "Fashion",
  "Beauty",
  "Grooming",
  "Lifestyle",
  "Fitness",
  "Health & Wellness",
  "Food",
  "Travel",
  "Comedy",
  "Parenting",
  "Tech",
  "Education",
  "Finance",
  "Dance",
  "Music",
  "Art & Craft",
  "Gaming",
  "Photography",
  "Couple",
  "Home & Decor",
  "Pets",
  "Spirituality",
  "Motivation",
  "Automotive",
  "Sports",
  "Acting",
] as const;

const RULES: [string, RegExp][] = [
  ["Fashion", /fashion|\bstyl(e|ing|ist)|outfit|ootd|cloth|apparel|jewel|accessor|saree|thrift/],
  ["Beauty", /beauty|make ?up|\bmua\b|cosmetic|skin|hair|\bnails?\b/],
  ["Grooming", /groom/],
  ["Lifestyle", /life ?style|vlog|day in (my|the) life|\bdaily\b/],
  ["Fitness", /fitness|\bgym|workout|yoga|bodybuild|\blift/],
  ["Health & Wellness", /health|wellness|nutrition|\bdiet|physio|doctor|medical|mental/],
  ["Food", /food|\bcook|recipe|\bchef|\bbak(e|er|ing)|\bcafe|restaurant/],
  ["Travel", /travel|wander|explor|\btrips?\b|backpack/],
  ["Comedy", /comed|comic|funny|meme|roast|humou?r|\bskit|relatable/],
  ["Parenting", /\bmom|\bmum(my|ma)?\b|mother|parent|\bkids?\b|\bbaby|family/],
  ["Tech", /\btech|gadget|coding/],
  ["Education", /educat|\bstudy|student|\bteach|learn|career|knowledge/],
  ["Finance", /financ|money|\bstock|invest|trading/],
  ["Dance", /danc/],
  ["Music", /music|\bsing(er|ing)?\b|\bsongs?\b|rapper/],
  ["Art & Craft", /\barts?\b|artist|craft|\bdiy\b|mehe?n?di|drawing|paint/],
  ["Gaming", /\bgam(e|es|ing|er)\b/],
  ["Photography", /photo/],
  ["Couple", /couple/],
  ["Home & Decor", /\bhome\b|decor|interior/],
  ["Pets", /\bpets?\b|\bdogs?\b|\bcats?\b/],
  ["Spirituality", /spiritual|tarot|astro/],
  ["Motivation", /motivat|self ?help|productiv/],
  ["Automotive", /\bauto(mobile|motive)?\b|\bcars?\b|\bbikes?\b|\bmoto/],
  ["Sports", /\bsports?\b|cricket|football/],
  ["Acting", /\bact(or|ress|ing)\b/],
];

export function detectGenres(text: string): string[] {
  const t = text.toLowerCase();
  return RULES.filter(([, re]) => re.test(t)).map(([g]) => g);
}

export function isUgc(text: string): boolean {
  return /\bugc\b/i.test(text);
}
