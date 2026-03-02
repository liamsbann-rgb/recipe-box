import * as cheerio from "cheerio";

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    // Fetch the page
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RecipeBox/1.0)",
        "Accept": "text/html",
      },
    });

    if (!response.ok) {
      return res.status(400).json({ error: "Could not fetch that URL. Check the link and try again." });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Try to find JSON-LD recipe schema (most recipe sites use this)
    let recipe = null;

    $('script[type="application/ld+json"]').each((_, el) => {
      if (recipe) return;
      try {
        let data = JSON.parse($(el).html());

        // Handle @graph arrays (common in WordPress/Yoast)
        if (data["@graph"]) {
          data = data["@graph"].find((item) => item["@type"] === "Recipe" || (Array.isArray(item["@type"]) && item["@type"].includes("Recipe")));
          if (!data) return;
        }

        // Handle arrays of schemas
        if (Array.isArray(data)) {
          data = data.find((item) => item["@type"] === "Recipe" || (Array.isArray(item["@type"]) && item["@type"].includes("Recipe")));
          if (!data) return;
        }

        const type = data["@type"];
        if (type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"))) {
          recipe = data;
        }
      } catch {}
    });

    if (!recipe) {
      // Fallback: try extracting from meta tags and page content
      const title = $('meta[property="og:title"]').attr("content") || $("title").text() || "";
      return res.status(200).json({
        success: false,
        partial: true,
        data: {
          title: title.trim(),
          ingredients: [],
          steps: [],
          notes: "Could not auto-extract recipe data. You may need to fill in the details manually.",
        },
      });
    }

    // Parse ingredients
    let ingredients = [];
    if (recipe.recipeIngredient) {
      ingredients = recipe.recipeIngredient.map((i) => typeof i === "string" ? i.trim() : String(i).trim());
    }

    // Parse instructions
    let steps = [];
    if (recipe.recipeInstructions) {
      if (Array.isArray(recipe.recipeInstructions)) {
        recipe.recipeInstructions.forEach((step) => {
          if (typeof step === "string") {
            steps.push(step.trim());
          } else if (step["@type"] === "HowToStep") {
            steps.push((step.text || "").trim());
          } else if (step["@type"] === "HowToSection" && Array.isArray(step.itemListElement)) {
            step.itemListElement.forEach((sub) => {
              if (typeof sub === "string") steps.push(sub.trim());
              else if (sub.text) steps.push(sub.text.trim());
            });
          }
        });
      } else if (typeof recipe.recipeInstructions === "string") {
        steps = recipe.recipeInstructions.split(/\n+/).map((s) => s.trim()).filter(Boolean);
      }
    }

    // Parse times
    const parseDuration = (iso) => {
      if (!iso) return "";
      const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
      if (!match) return "";
      const hours = match[1] ? `${match[1]}h ` : "";
      const mins = match[2] ? `${match[2]} min` : "";
      return (hours + mins).trim();
    };

    // Parse yield/servings
    let servings = "";
    if (recipe.recipeYield) {
      const y = Array.isArray(recipe.recipeYield) ? recipe.recipeYield[0] : recipe.recipeYield;
      servings = String(y).replace(/\D*(\d+).*/, "$1") || String(y);
    }

    const result = {
      title: (recipe.name || "").trim(),
      ingredients,
      steps: steps.filter(Boolean),
      prepTime: parseDuration(recipe.prepTime),
      cookTime: parseDuration(recipe.cookTime),
      servings,
      notes: (recipe.description || "").trim(),
      category: "",
    };

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("Scrape error:", err);
    return res.status(500).json({ error: "Something went wrong while importing. Please try again." });
  }
}
