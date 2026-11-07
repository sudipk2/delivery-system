export default async (request) => {
    if (request.method !== "POST") {
      return Response.json(
        { error: "Method not allowed." },
        { status: 405 }
      );
    }
  
    try {
      const apiKey = process.env.GEMINI_API_KEY;
  
      if (!apiKey) {
        return Response.json(
          { error: "Gemini API key is not configured on Netlify." },
          { status: 500 }
        );
      }
  
      const { mood, menu } = await request.json();
  
      if (!mood || typeof mood !== "string" || mood.length > 300) {
        return Response.json(
          { error: "Please enter a valid mood or craving." },
          { status: 400 }
        );
      }
  
      if (!Array.isArray(menu) || menu.length === 0) {
        return Response.json(
          { error: "No available dishes were provided." },
          { status: 400 }
        );
      }
  
      // Only use real menu items supplied by SmartBite.
      const safeMenu = menu.slice(0, 100).map(item => ({
        id: String(item.id),
        name: String(item.name),
        description: String(item.description || ""),
        category: String(item.category || ""),
        restaurant: String(item.restaurant || ""),
        price: Number(item.price)
      }));
  
      const prompt = `
  You are SmartBite's food recommendation assistant.
  
  The customer says:
  ${mood}
  
  Available dishes from SmartBite:
  ${JSON.stringify(safeMenu)}
  
  Recommend up to 3 dishes that best match the customer's mood.
  
  Rules:
  - Recommend ONLY dishes from the supplied menu.
  - Use the exact dish IDs supplied.
  - Never invent a dish, restaurant, price, or availability.
  - Consider the customer's craving, mood, and food preferences.
  - If the mood is spicy, prefer dishes described as spicy.
  - If no dish matches perfectly, suggest the closest available options.
  - Keep each reason friendly and short.
  - Return JSON only, in this exact format:
  {
    "recommendations": [
      {
        "dishId": "exact-id-from-menu",
        "reason": "Short explanation"
      }
    ],
    "message": "A short friendly introduction"
  }
  `;
  
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }]
              }
            ],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.4
            }
          })
        }
      );
  
      const data = await response.json();
  
      if (!response.ok) {
        console.error("Gemini error:", data);
        return Response.json(
          { error: "Gemini could not generate recommendations." },
          { status: 502 }
        );
      }
  
      const answer = data.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("");
  
      if (!answer) {
        return Response.json(
          { error: "Gemini returned an empty response." },
          { status: 502 }
        );
      }
  
      const result = JSON.parse(answer);
  
      // Validate every returned ID against the real supplied menu.
      const validIds = new Set(safeMenu.map(item => item.id));
  
      result.recommendations = (result.recommendations || [])
        .filter(item => validIds.has(String(item.dishId)))
        .slice(0, 3);
  
      return Response.json(result);
  
    } catch (error) {
      console.error("Recommendation function error:", error);
  
      return Response.json(
        { error: "Unable to generate food recommendations." },
        { status: 500 }
      );
    }
  };