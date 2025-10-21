// GET /api/quote
export default async function handler(req, res) {
  const quotes = [
    {
      message: "Tea is the elixir of life.",
      author: "Lu Yu"
    },
    {
      message: "Tea tempers the spirits and harmonizes the mind.",
      author: "Lu Tung"
    },
    {
      message: "Tea is a religion of the art of life.",
      author: "Kakuzo Okakura"
    }
  ];

  // Return a random quote
  const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
  
  res.status(200).json(randomQuote);
}
