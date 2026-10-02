const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error('OPENAI_API_KEY is required to create a Journal draft.');
}

const day = new Date().getUTCDay();
const laneByDay = {
  1: 'practical card-pricing guidance',
  3: 'a useful collecting habit or binder tip',
  5: 'a collector-first feature or market perspective that avoids time-sensitive claims',
};
const lane = laneByDay[day] ?? 'a useful, evergreen Pokémon collecting topic';

const prompt = `Write one unpublished Collect Valor Journal draft about ${lane}.

Return Markdown only. Include, in this exact order:
1. A title on the first line as an H1.
2. A one-sentence meta description on the second line, beginning with "Meta description: ".
3. The article body, 550 to 750 words, with useful H2 headings.
4. A final line beginning with "Suggested slug: ".

Audience: Pokémon card collectors. Voice: plainspoken, useful, collector-first, and honest.
Rules: write original content; do not claim current prices, release news, sales data, or other facts that need fresh research; do not give financial guarantees; do not imply Collect Valor is affiliated with Pokémon, The Pokémon Company, TCGplayer, or any other third party; do not mention features that are not confirmed in the app. The draft is for human review, not direct publishing.`;

const response = await fetch('https://api.openai.com/v1/responses', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: process.env.OPENAI_JOURNAL_MODEL || 'gpt-5-mini',
    input: prompt,
    max_output_tokens: 2200,
    store: false,
  }),
});

if (!response.ok) {
  throw new Error(`OpenAI request failed: ${response.status} ${await response.text()}`);
}

const payload = await response.json();
const draft = (payload.output_text
  || payload.output
    ?.flatMap((item) => item.content || [])
    .filter((item) => item.type === 'output_text')
    .map((item) => item.text)
    .join(''))?.trim();

if (!draft) {
  throw new Error('OpenAI returned no Journal draft.');
}

console.log(draft);
