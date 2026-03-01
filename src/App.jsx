import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "recipes-data";

const CATEGORIES = ["Breakfast", "Healthy Lunch", "Healthy Dinner", "Date Night", "Sunday Specials", "Snacks", "Sweet Treats", "Work Lunches"];

const EMPTY_RECIPE = {
  title: "",
  category: "Healthy Dinner",
  prepTime: "",
  cookTime: "",
  servings: "",
  ingredients: [""],
  steps: [""],
  notes: "",
  rating: 0,
  image: "",
};

const SAMPLE_RECIPES = [
  {
    id: "sample-1",
    title: "Classic Pasta Aglio e Olio",
    category: "Date Night",
    prepTime: "5 min",
    cookTime: "15 min",
    servings: "4",
    ingredients: [
      "400g spaghetti",
      "6 cloves garlic, thinly sliced",
      "½ cup extra virgin olive oil",
      "1 tsp red pepper flakes",
      "½ cup fresh parsley, chopped",
      "Salt & freshly ground black pepper",
      "Parmigiano-Reggiano for serving",
    ],
    steps: [
      "Bring a large pot of salted water to a boil and cook spaghetti until al dente.",
      "While pasta cooks, heat olive oil in a large skillet over medium-low heat. Add garlic and cook until golden (not brown), about 2 minutes.",
      "Add red pepper flakes and remove from heat.",
      "Reserve 1 cup pasta water, then drain pasta and add to the skillet.",
      "Toss over low heat, adding pasta water a splash at a time until silky.",
      "Finish with parsley, salt, pepper, and a generous shower of Parmigiano.",
    ],
    notes: "The secret is patience with the garlic — golden, never burnt.",
    rating: 5,
    image: "🍝",
    createdAt: Date.now(),
  },
  {
    id: "sample-2",
    title: "Honey Sriracha Glazed Salmon",
    category: "Healthy Dinner",
    prepTime: "10 min",
    cookTime: "12 min",
    servings: "2",
    ingredients: [
      "2 salmon fillets (6oz each)",
      "2 tbsp honey",
      "1 tbsp sriracha",
      "1 tbsp soy sauce",
      "1 clove garlic, minced",
      "1 tsp sesame oil",
      "Sesame seeds & green onion for garnish",
    ],
    steps: [
      "Preheat oven to 400°F (200°C). Line a baking sheet with parchment.",
      "Whisk honey, sriracha, soy sauce, garlic, and sesame oil together.",
      "Place salmon skin-side down on baking sheet. Brush generously with glaze.",
      "Bake 10–12 minutes until salmon flakes easily with a fork.",
      "Garnish with sesame seeds and sliced green onion.",
    ],
    notes: "Works great on the grill too. Double the glaze for extra dipping.",
    rating: 4,
    image: "🐟",
    createdAt: Date.now() - 100000,
  },
];

const FOOD_EMOJIS = ["🍝", "🥗", "🍜", "🥘", "🍲", "🍛", "🥧", "🍰", "🧁", "🥞", "🍳", "🥪", "🌮", "🍔", "🍕", "🐟", "🍗", "🥩", "🍤", "🥑", "🫕", "☕", "🧇", "🥐", "🍱"];

export default function RecipeTracker() {
  const [recipes, setRecipes] = useState([]);
  const [view, setView] = useState("grid"); // grid | detail | form
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [formData, setFormData] = useState({ ...EMPTY_RECIPE });
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [loaded, setLoaded] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Load from storage
  useEffect(() => {
    async function load() {
      try {
        const result = await window.storage.get(STORAGE_KEY, true);
        if (result?.value) {
          setRecipes(JSON.parse(result.value));
        } else {
          // Load samples for first time
          setRecipes(SAMPLE_RECIPES);
          await window.storage.set(STORAGE_KEY, JSON.stringify(SAMPLE_RECIPES), true);
        }
      } catch {
        setRecipes(SAMPLE_RECIPES);
      }
      setLoaded(true);
    }
    load();
  }, []);

  // Save to storage
  const persist = useCallback(async (data) => {
    try {
      await window.storage.set(STORAGE_KEY, JSON.stringify(data), true);
    } catch (e) {
      console.error("Storage error:", e);
    }
  }, []);

  const filteredRecipes = recipes.filter((r) => {
    const matchesSearch =
      !search ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.ingredients.some((i) => i.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = filterCategory === "All" || r.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSave = () => {
    if (!formData.title.trim()) return;
    const cleaned = {
      ...formData,
      ingredients: formData.ingredients.filter((i) => i.trim()),
      steps: formData.steps.filter((s) => s.trim()),
    };
    let updated;
    if (editingId) {
      updated = recipes.map((r) => (r.id === editingId ? { ...cleaned, id: editingId, createdAt: r.createdAt } : r));
    } else {
      const newRecipe = { ...cleaned, id: `r-${Date.now()}`, createdAt: Date.now() };
      updated = [newRecipe, ...recipes];
    }
    setRecipes(updated);
    persist(updated);
    setView("grid");
    setEditingId(null);
    setFormData({ ...EMPTY_RECIPE });
  };

  const handleDelete = (id) => {
    const updated = recipes.filter((r) => r.id !== id);
    setRecipes(updated);
    persist(updated);
    setView("grid");
    setSelectedRecipe(null);
    setDeleteConfirm(null);
  };

  const handleEdit = (recipe) => {
    setFormData({ ...recipe });
    setEditingId(recipe.id);
    setView("form");
  };

  const openDetail = (recipe) => {
    setSelectedRecipe(recipe);
    setView("detail");
  };

  const addListItem = (field) => {
    setFormData({ ...formData, [field]: [...formData[field], ""] });
  };

  const updateListItem = (field, index, value) => {
    const updated = [...formData[field]];
    updated[index] = value;
    setFormData({ ...formData, [field]: updated });
  };

  const removeListItem = (field, index) => {
    if (formData[field].length <= 1) return;
    const updated = formData[field].filter((_, i) => i !== index);
    setFormData({ ...formData, [field]: updated });
  };

  const setRating = (recipe, rating) => {
    const updated = recipes.map((r) => (r.id === recipe.id ? { ...r, rating } : r));
    setRecipes(updated);
    persist(updated);
    if (selectedRecipe?.id === recipe.id) setSelectedRecipe({ ...recipe, rating });
  };

  if (!loaded) {
    return (
      <div style={styles.loadingWrap}>
        <div style={styles.loadingText}>Loading your recipes...</div>
      </div>
    );
  }

  // ── FORM VIEW ──
  if (view === "form") {
    return (
      <div style={styles.app}>
        <div style={styles.formContainer}>
          <div style={styles.formHeader}>
            <button style={styles.backBtn} onClick={() => { setView("grid"); setEditingId(null); setFormData({ ...EMPTY_RECIPE }); }}>
              ← Back
            </button>
            <h2 style={styles.formTitle}>{editingId ? "Edit Recipe" : "New Recipe"}</h2>
          </div>

          <div style={styles.formGrid}>
            {/* Emoji Picker */}
            <div style={styles.emojiSection}>
              <div
                style={styles.emojiDisplay}
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                {formData.image || "🍽️"}
              </div>
              {showEmojiPicker && (
                <div style={styles.emojiGrid}>
                  {FOOD_EMOJIS.map((e) => (
                    <span
                      key={e}
                      style={styles.emojiOption}
                      onClick={() => { setFormData({ ...formData, image: e }); setShowEmojiPicker(false); }}
                    >
                      {e}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div style={styles.formField}>
              <label style={styles.label}>Recipe Title *</label>
              <input
                style={styles.input}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Grandma's Sunday Roast"
              />
            </div>

            <div style={styles.formRow}>
              <div style={styles.formField}>
                <label style={styles.label}>Category</label>
                <select
                  style={styles.select}
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div style={styles.formField}>
                <label style={styles.label}>Servings</label>
                <input style={styles.input} value={formData.servings} onChange={(e) => setFormData({ ...formData, servings: e.target.value })} placeholder="4" />
              </div>
            </div>

            <div style={styles.formRow}>
              <div style={styles.formField}>
                <label style={styles.label}>Prep Time</label>
                <input style={styles.input} value={formData.prepTime} onChange={(e) => setFormData({ ...formData, prepTime: e.target.value })} placeholder="15 min" />
              </div>
              <div style={styles.formField}>
                <label style={styles.label}>Cook Time</label>
                <input style={styles.input} value={formData.cookTime} onChange={(e) => setFormData({ ...formData, cookTime: e.target.value })} placeholder="30 min" />
              </div>
            </div>

            {/* Ingredients */}
            <div style={styles.formField}>
              <label style={styles.label}>Ingredients</label>
              {formData.ingredients.map((ing, i) => (
                <div key={i} style={styles.listRow}>
                  <input
                    style={{ ...styles.input, flex: 1 }}
                    value={ing}
                    onChange={(e) => updateListItem("ingredients", i, e.target.value)}
                    placeholder={`Ingredient ${i + 1}`}
                  />
                  {formData.ingredients.length > 1 && (
                    <button style={styles.removeBtn} onClick={() => removeListItem("ingredients", i)}>×</button>
                  )}
                </div>
              ))}
              <button style={styles.addBtn} onClick={() => addListItem("ingredients")}>+ Add Ingredient</button>
            </div>

            {/* Steps */}
            <div style={styles.formField}>
              <label style={styles.label}>Steps</label>
              {formData.steps.map((step, i) => (
                <div key={i} style={styles.listRow}>
                  <span style={styles.stepNum}>{i + 1}</span>
                  <textarea
                    style={{ ...styles.textarea, flex: 1 }}
                    value={step}
                    onChange={(e) => updateListItem("steps", i, e.target.value)}
                    placeholder={`Step ${i + 1}`}
                    rows={2}
                  />
                  {formData.steps.length > 1 && (
                    <button style={styles.removeBtn} onClick={() => removeListItem("steps", i)}>×</button>
                  )}
                </div>
              ))}
              <button style={styles.addBtn} onClick={() => addListItem("steps")}>+ Add Step</button>
            </div>

            <div style={styles.formField}>
              <label style={styles.label}>Notes</label>
              <textarea
                style={styles.textarea}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Tips, variations, or stories behind this recipe..."
                rows={3}
              />
            </div>

            <button
              style={{ ...styles.saveBtn, opacity: formData.title.trim() ? 1 : 0.5 }}
              onClick={handleSave}
              disabled={!formData.title.trim()}
            >
              {editingId ? "Update Recipe" : "Save Recipe"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── DETAIL VIEW ──
  if (view === "detail" && selectedRecipe) {
    const r = selectedRecipe;
    return (
      <div style={styles.app}>
        <div style={styles.detailContainer}>
          <div style={styles.detailTop}>
            <button style={styles.backBtn} onClick={() => setView("grid")}>← Back</button>
            <div style={styles.detailActions}>
              <button style={styles.editBtn} onClick={() => handleEdit(r)}>Edit</button>
              {deleteConfirm === r.id ? (
                <span style={styles.confirmWrap}>
                  <span style={styles.confirmText}>Delete?</span>
                  <button style={styles.confirmYes} onClick={() => handleDelete(r.id)}>Yes</button>
                  <button style={styles.confirmNo} onClick={() => setDeleteConfirm(null)}>No</button>
                </span>
              ) : (
                <button style={styles.deleteBtn} onClick={() => setDeleteConfirm(r.id)}>Delete</button>
              )}
            </div>
          </div>

          <div style={styles.detailHero}>
            <span style={styles.detailEmoji}>{r.image || "🍽️"}</span>
            <div>
              <h1 style={styles.detailTitle}>{r.title}</h1>
              <div style={styles.detailMeta}>
                <span style={styles.badge}>{r.category}</span>
                {r.prepTime && <span style={styles.metaItem}>🕐 Prep: {r.prepTime}</span>}
                {r.cookTime && <span style={styles.metaItem}>🔥 Cook: {r.cookTime}</span>}
                {r.servings && <span style={styles.metaItem}>🍽️ Serves: {r.servings}</span>}
              </div>
              <div style={styles.stars}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <span
                    key={s}
                    style={{ ...styles.star, color: s <= r.rating ? "#E8A838" : "#ddd", cursor: "pointer" }}
                    onClick={() => setRating(r, s)}
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div style={styles.detailBody}>
            <div style={styles.detailSection}>
              <h3 style={styles.sectionTitle}>Ingredients</h3>
              <div style={styles.ingredientsList}>
                {r.ingredients.map((ing, i) => (
                  <div key={i} style={styles.ingredientItem}>
                    <span style={styles.dot}>●</span>
                    <span>{ing}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.detailSection}>
              <h3 style={styles.sectionTitle}>Directions</h3>
              {r.steps.map((step, i) => (
                <div key={i} style={styles.stepItem}>
                  <span style={styles.stepCircle}>{i + 1}</span>
                  <p style={styles.stepText}>{step}</p>
                </div>
              ))}
            </div>

            {r.notes && (
              <div style={{ ...styles.detailSection, ...styles.notesBox }}>
                <h3 style={styles.sectionTitle}>Chef's Notes</h3>
                <p style={styles.notesText}>{r.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── GRID VIEW ──
  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.logo}>
            <span style={styles.logoIcon}>📖</span> Liam and Abby's Kitchen
          </h1>
          <p style={styles.subtitle}>{recipes.length} recipe{recipes.length !== 1 ? "s" : ""} saved</p>
        </div>
        <button
          style={styles.newBtn}
          onClick={() => { setFormData({ ...EMPTY_RECIPE }); setEditingId(null); setView("form"); }}
        >
          + New Recipe
        </button>
      </header>

      <div style={styles.toolbar}>
        <div style={styles.searchWrap}>
          <span style={styles.searchIcon}>🔍</span>
          <input
            style={styles.searchInput}
            placeholder="Search recipes or ingredients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button style={styles.clearSearch} onClick={() => setSearch("")}>×</button>
          )}
        </div>
        <div style={styles.filters}>
          {["All", ...CATEGORIES].map((c) => (
            <button
              key={c}
              style={{
                ...styles.filterChip,
                ...(filterCategory === c ? styles.filterChipActive : {}),
              }}
              onClick={() => setFilterCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {filteredRecipes.length === 0 ? (
        <div style={styles.empty}>
          <span style={styles.emptyIcon}>🍳</span>
          <p style={styles.emptyText}>
            {recipes.length === 0
              ? "Your recipe box is empty. Add your first recipe!"
              : "No recipes match your search."}
          </p>
        </div>
      ) : (
        <div style={styles.grid}>
          {filteredRecipes.map((r) => (
            <div key={r.id} style={styles.card} onClick={() => openDetail(r)}>
              <div style={styles.cardTop}>
                <span style={styles.cardEmoji}>{r.image || "🍽️"}</span>
                <span style={styles.cardBadge}>{r.category}</span>
              </div>
              <h3 style={styles.cardTitle}>{r.title}</h3>
              <div style={styles.cardMeta}>
                {r.prepTime && <span>🕐 {r.prepTime}</span>}
                {r.cookTime && <span>🔥 {r.cookTime}</span>}
                {r.servings && <span>🍽️ {r.servings}</span>}
              </div>
              <div style={styles.cardStars}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <span key={s} style={{ color: s <= r.rating ? "#E8A838" : "#ddd", fontSize: 14 }}>★</span>
                ))}
              </div>
              <p style={styles.cardIngredients}>
                {r.ingredients.slice(0, 3).join(" · ")}{r.ingredients.length > 3 ? " ..." : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── STYLES ──
const styles = {
  app: {
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    background: "linear-gradient(145deg, #FDF6EC 0%, #FFF9F0 40%, #F5EDE3 100%)",
    minHeight: "100vh",
    padding: "24px",
    color: "#3D2E1F",
  },
  loadingWrap: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#FDF6EC" },
  loadingText: { fontFamily: "'DM Sans', sans-serif", fontSize: 18, color: "#A08060" },

  // Header
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 16 },
  headerLeft: {},
  logo: { fontSize: 28, fontWeight: 800, color: "#3D2E1F", margin: 0, letterSpacing: "-0.5px" },
  logoIcon: { fontSize: 26 },
  subtitle: { margin: "4px 0 0", fontSize: 14, color: "#A08060", fontWeight: 400 },
  newBtn: {
    background: "#C75B2A",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "12px 24px",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(199,91,42,0.3)",
    transition: "transform 0.15s",
  },

  // Toolbar
  toolbar: { marginBottom: 24 },
  searchWrap: {
    position: "relative",
    marginBottom: 12,
  },
  searchIcon: { position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16 },
  searchInput: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 40px 12px 42px",
    border: "2px solid #E8DDD0",
    borderRadius: 12,
    fontSize: 15,
    background: "#FFFDF8",
    color: "#3D2E1F",
    outline: "none",
    fontFamily: "inherit",
  },
  clearSearch: {
    position: "absolute",
    right: 12,
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    fontSize: 20,
    cursor: "pointer",
    color: "#A08060",
  },
  filters: { display: "flex", gap: 8, flexWrap: "wrap" },
  filterChip: {
    padding: "6px 16px",
    border: "2px solid #E8DDD0",
    borderRadius: 20,
    background: "transparent",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    color: "#6B5744",
    fontFamily: "inherit",
    transition: "all 0.15s",
  },
  filterChipActive: {
    background: "#3D2E1F",
    color: "#FDF6EC",
    borderColor: "#3D2E1F",
  },

  // Grid
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 20,
  },
  card: {
    background: "#FFFDF8",
    borderRadius: 16,
    padding: 20,
    border: "2px solid #EDE5DA",
    cursor: "pointer",
    transition: "transform 0.15s, box-shadow 0.15s",
    boxShadow: "0 1px 4px rgba(61,46,31,0.06)",
  },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  cardEmoji: { fontSize: 36 },
  cardBadge: {
    background: "#F0E6D8",
    color: "#6B5744",
    padding: "4px 12px",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
  },
  cardTitle: { fontSize: 18, fontWeight: 700, margin: "0 0 8px", lineHeight: 1.3 },
  cardMeta: { display: "flex", gap: 12, fontSize: 13, color: "#A08060", marginBottom: 8 },
  cardStars: { marginBottom: 8 },
  cardIngredients: { fontSize: 13, color: "#A08060", margin: 0, lineHeight: 1.5 },

  // Empty
  empty: { textAlign: "center", padding: "60px 20px" },
  emptyIcon: { fontSize: 48, display: "block", marginBottom: 12 },
  emptyText: { fontSize: 16, color: "#A08060" },

  // Form
  formContainer: { maxWidth: 640, margin: "0 auto" },
  formHeader: { display: "flex", alignItems: "center", gap: 16, marginBottom: 24 },
  formTitle: { fontSize: 24, fontWeight: 700, margin: 0 },
  formGrid: { display: "flex", flexDirection: "column", gap: 20 },
  formField: { display: "flex", flexDirection: "column", gap: 6 },
  formRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  label: { fontSize: 13, fontWeight: 600, color: "#6B5744", textTransform: "uppercase", letterSpacing: "0.5px" },
  input: {
    padding: "10px 14px",
    border: "2px solid #E8DDD0",
    borderRadius: 10,
    fontSize: 15,
    background: "#FFFDF8",
    color: "#3D2E1F",
    outline: "none",
    fontFamily: "inherit",
  },
  select: {
    padding: "10px 14px",
    border: "2px solid #E8DDD0",
    borderRadius: 10,
    fontSize: 15,
    background: "#FFFDF8",
    color: "#3D2E1F",
    outline: "none",
    fontFamily: "inherit",
  },
  textarea: {
    padding: "10px 14px",
    border: "2px solid #E8DDD0",
    borderRadius: 10,
    fontSize: 15,
    background: "#FFFDF8",
    color: "#3D2E1F",
    outline: "none",
    fontFamily: "inherit",
    resize: "vertical",
  },
  listRow: { display: "flex", gap: 8, alignItems: "center", marginBottom: 6 },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "#3D2E1F",
    color: "#FDF6EC",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
  },
  removeBtn: {
    width: 32,
    height: 32,
    border: "none",
    borderRadius: 8,
    background: "#F5E0D0",
    color: "#C75B2A",
    fontSize: 18,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  addBtn: {
    background: "none",
    border: "2px dashed #D4C8BA",
    borderRadius: 10,
    padding: "10px",
    fontSize: 14,
    color: "#A08060",
    cursor: "pointer",
    fontFamily: "inherit",
    fontWeight: 600,
  },
  saveBtn: {
    background: "#C75B2A",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "14px 24px",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(199,91,42,0.3)",
    marginTop: 8,
    fontFamily: "inherit",
  },
  emojiSection: { position: "relative", alignSelf: "flex-start" },
  emojiDisplay: {
    width: 72,
    height: 72,
    borderRadius: 16,
    background: "#F0E6D8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 36,
    cursor: "pointer",
    border: "2px solid #E8DDD0",
  },
  emojiGrid: {
    position: "absolute",
    top: 80,
    left: 0,
    background: "#FFFDF8",
    border: "2px solid #E8DDD0",
    borderRadius: 12,
    padding: 8,
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 4,
    zIndex: 10,
    boxShadow: "0 8px 24px rgba(61,46,31,0.12)",
  },
  emojiOption: { fontSize: 24, padding: 6, cursor: "pointer", textAlign: "center", borderRadius: 8 },

  // Detail
  detailContainer: { maxWidth: 720, margin: "0 auto" },
  detailTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  detailActions: { display: "flex", gap: 8, alignItems: "center" },
  backBtn: {
    background: "none",
    border: "none",
    fontSize: 15,
    fontWeight: 600,
    color: "#C75B2A",
    cursor: "pointer",
    padding: 0,
    fontFamily: "inherit",
  },
  editBtn: {
    background: "#F0E6D8",
    border: "none",
    borderRadius: 10,
    padding: "8px 18px",
    fontSize: 14,
    fontWeight: 600,
    color: "#3D2E1F",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  deleteBtn: {
    background: "none",
    border: "2px solid #E8DDD0",
    borderRadius: 10,
    padding: "8px 18px",
    fontSize: 14,
    fontWeight: 600,
    color: "#C75B2A",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  confirmWrap: { display: "flex", alignItems: "center", gap: 6 },
  confirmText: { fontSize: 13, fontWeight: 600, color: "#C75B2A" },
  confirmYes: {
    background: "#C75B2A", color: "#fff", border: "none", borderRadius: 8,
    padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
  },
  confirmNo: {
    background: "#F0E6D8", color: "#3D2E1F", border: "none", borderRadius: 8,
    padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
  },
  detailHero: { display: "flex", gap: 20, alignItems: "flex-start", marginBottom: 32 },
  detailEmoji: {
    fontSize: 56,
    width: 88,
    height: 88,
    borderRadius: 20,
    background: "#F0E6D8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  detailTitle: { fontSize: 28, fontWeight: 800, margin: "0 0 8px", lineHeight: 1.2 },
  detailMeta: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 8 },
  badge: {
    background: "#3D2E1F",
    color: "#FDF6EC",
    padding: "4px 14px",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 700,
  },
  metaItem: { fontSize: 14, color: "#A08060" },
  stars: { display: "flex", gap: 2 },
  star: { fontSize: 22 },

  detailBody: { display: "flex", flexDirection: "column", gap: 28 },
  detailSection: {},
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "1px",
    color: "#A08060",
    marginBottom: 12,
    marginTop: 0,
    borderBottom: "2px solid #E8DDD0",
    paddingBottom: 8,
  },
  ingredientsList: { display: "flex", flexDirection: "column", gap: 6 },
  ingredientItem: { display: "flex", gap: 10, alignItems: "baseline", fontSize: 16, lineHeight: 1.6 },
  dot: { color: "#C75B2A", fontSize: 8, flexShrink: 0, marginTop: 4 },
  stepItem: { display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 16 },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "#C75B2A",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 700,
    flexShrink: 0,
    marginTop: 2,
  },
  stepText: { margin: 0, fontSize: 16, lineHeight: 1.6, flex: 1 },
  notesBox: {
    background: "#F8F0E4",
    borderRadius: 14,
    padding: 20,
    border: "2px solid #E8DDD0",
  },
  notesText: { margin: 0, fontSize: 15, lineHeight: 1.7, color: "#6B5744", fontStyle: "italic" },
};
