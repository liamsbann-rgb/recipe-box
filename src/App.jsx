import { useState, useEffect, useCallback } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, where, getDocs, getDoc } from "firebase/firestore";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, onAuthStateChanged, signOut } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCF8-fy294bODgClSIsNME1rAtuw71JCHA",
  authDomain: "recipe-box-706db.firebaseapp.com",
  projectId: "recipe-box-706db",
  storageBucket: "recipe-box-706db.firebasestorage.app",
  messagingSenderId: "627005649584",
  appId: "1:627005649584:web:e08cdc375333525f53c175",
  measurementId: "G-KZQK6ZZQHP"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const CATEGORIES = ["Breakfast", "Healthy Lunch", "Healthy Dinner", "Date Night", "Sunday Specials", "Snacks", "Sweet Treats", "Work Lunches"];

const EMPTY_RECIPE = {
  title: "", category: "Healthy Dinner", prepTime: "", cookTime: "",
  servings: "", ingredients: [""], steps: [""], notes: "", rating: 0, image: "",
};

const FOOD_EMOJIS = ["\ud83c\udf5d", "\ud83e\udd57", "\ud83c\udf5c", "\ud83e\udd58", "\ud83c\udf72", "\ud83c\udf5b", "\ud83e\udd67", "\ud83c\udf70", "\ud83e\uddc1", "\ud83e\udd5e", "\ud83c\udf73", "\ud83e\udd6a", "\ud83c\udf2e", "\ud83c\udf54", "\ud83c\udf55", "\ud83d\udc1f", "\ud83c\udf57", "\ud83e\udd69", "\ud83c\udf64", "\ud83e\udd51", "\ud83e\udED5", "\u2615", "\ud83e\uddc7", "\ud83e\udd50", "\ud83c\udf71"];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEAL_SLOTS = ["Breakfast", "Lunch", "Dinner", "Snack"];
const MULTIPLIERS = [0.5, 1, 1.5, 2, 3];

function scaleIngredient(text, multiplier) {
  if (multiplier === 1) return text;
  const fractionMap = { "\u00bd": 0.5, "\u2153": 0.33, "\u2154": 0.67, "\u00bc": 0.25, "\u00be": 0.75 };
  let processed = text;
  for (const [frac, val] of Object.entries(fractionMap)) {
    processed = processed.replace(frac, String(val));
  }
  const match = processed.match(/^(\d+\/\d+|\d+\.?\d*)\s*/);
  if (!match) return text;
  let num;
  if (match[1].includes("/")) {
    const [n, d] = match[1].split("/").map(Number);
    num = n / d;
  } else {
    num = parseFloat(match[1]);
  }
  const scaled = num * multiplier;
  const formatted = scaled % 1 === 0 ? String(scaled) : scaled.toFixed(1).replace(/\.0$/, "");
  return processed.replace(match[0], formatted + " ");
}

function getWeekKey(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + offset * 7);
  return monday.toISOString().split("T")[0];
}

function getWeekDates(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + offset * 7);
  return DAYS.map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

// ── LOGIN SCREEN ──
function LoginScreen() {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) { setError("Please enter your email and password."); return; }
    if (mode === "signup" && !name.trim()) { setError("Please enter your name."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    setError("");
    try {
      if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name.trim() });
        // Save profile for friends lookup
        await setDoc(doc(db, "profiles", cred.user.uid), {
          name: name.trim(),
          email: email.toLowerCase().trim(),
          uid: cred.user.uid,
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (e) {
      if (e.code === "auth/user-not-found" || e.code === "auth/invalid-credential") setError("No account found. Sign up instead?");
      else if (e.code === "auth/wrong-password") setError("Incorrect password.");
      else if (e.code === "auth/email-already-in-use") setError("Account already exists. Try signing in.");
      else if (e.code === "auth/invalid-email") setError("Please enter a valid email.");
      else setError(e.message);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => { if (e.key === "Enter") handleSubmit(); };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(145deg, #FDF6EC 0%, #FFF9F0 40%, #F5EDE3 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', 'Segoe UI', sans-serif", padding: 24 }}>
      <div style={{ background: "#FFFDF8", borderRadius: 24, padding: "48px 40px", maxWidth: 400, width: "100%", textAlign: "center", border: "2px solid #EDE5DA", boxShadow: "0 8px 32px rgba(61,46,31,0.08)" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>{"\ud83d\udcd6"}</div>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#3D2E1F", margin: "0 0 8px" }}>Recipe Box</h1>
        <p style={{ fontSize: 16, color: "#A08060", margin: "0 0 28px", lineHeight: 1.5 }}>
          {mode === "signup" ? "Create your account to get started." : "Sign in to your personal kitchen."}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: "left" }}>
          {mode === "signup" && (
            <div>
              <label style={styles.label}>Your Name</label>
              <input style={{ ...styles.input, width: "100%", boxSizing: "border-box", marginTop: 4 }} placeholder="Liam" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={handleKeyDown} />
            </div>
          )}
          <div>
            <label style={styles.label}>Email</label>
            <input style={{ ...styles.input, width: "100%", boxSizing: "border-box", marginTop: 4 }} type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={handleKeyDown} />
          </div>
          <div>
            <label style={styles.label}>Password</label>
            <input style={{ ...styles.input, width: "100%", boxSizing: "border-box", marginTop: 4 }} type="password" placeholder={mode === "signup" ? "At least 6 characters" : "Your password"} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={handleKeyDown} />
          </div>
        </div>
        <button onClick={handleSubmit} disabled={loading} style={{ width: "100%", padding: "14px 24px", marginTop: 20, background: "#C75B2A", color: "#fff", border: "none", borderRadius: 14, fontSize: 16, fontWeight: 600, cursor: loading ? "wait" : "pointer", fontFamily: "inherit", boxShadow: "0 2px 8px rgba(199,91,42,0.3)", opacity: loading ? 0.7 : 1 }}>
          {loading ? "Please wait..." : mode === "signup" ? "Create Account" : "Sign In"}
        </button>
        {error && <p style={{ color: "#C75B2A", fontSize: 14, marginTop: 16, lineHeight: 1.4 }}>{error}</p>}
        <p style={{ fontSize: 14, color: "#A08060", marginTop: 20 }}>
          {mode === "login" ? (<>Don't have an account? <span onClick={() => { setMode("signup"); setError(""); }} style={{ color: "#C75B2A", fontWeight: 600, cursor: "pointer" }}>Sign up</span></>) : (<>Already have an account? <span onClick={() => { setMode("login"); setError(""); }} style={{ color: "#C75B2A", fontWeight: 600, cursor: "pointer" }}>Sign in</span></>)}
        </p>
        <p style={{ fontSize: 12, color: "#C0A888", marginTop: 16, lineHeight: 1.5 }}>Your recipes and meal plans are private to your account.</p>
      </div>
    </div>
  );
}

// ── FRIENDS KITCHEN COMPONENT ──
function FriendsKitchen({ user, onCopyRecipe }) {
  const [friendsList, setFriendsList] = useState([]);
  const [requests, setRequests] = useState([]);
  const [addEmail, setAddEmail] = useState("");
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [friendRecipes, setFriendRecipes] = useState([]);
  const [friendMealPlan, setFriendMealPlan] = useState({});
  const [friendWeekOffset, setFriendWeekOffset] = useState(0);
  const [viewingRecipe, setViewingRecipe] = useState(null);
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  // Listen for friends list
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, "profiles", user.uid, "friends"), (snap) => {
      setFriendsList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  // Listen for incoming friend requests
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, "profiles", user.uid, "friendRequests"), (snap) => {
      setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  // Send friend request
  const sendRequest = async () => {
    const email = addEmail.toLowerCase().trim();
    if (!email) return;
    if (email === user.email?.toLowerCase()) { setAddError("That's your own email!"); return; }
    setAddLoading(true); setAddError(""); setAddSuccess("");
    try {
      // Find user by email
      const q = query(collection(db, "profiles"), where("email", "==", email));
      const snap = await getDocs(q);
      if (snap.empty) { setAddError("No account found with that email."); setAddLoading(false); return; }
      const friendProfile = snap.docs[0].data();
      const friendUid = friendProfile.uid;
      // Check if already friends
      const existing = friendsList.find((f) => f.uid === friendUid);
      if (existing) { setAddError("You're already friends!"); setAddLoading(false); return; }
      // Send request to their friendRequests
      await setDoc(doc(db, "profiles", friendUid, "friendRequests", user.uid), {
        uid: user.uid,
        name: user.displayName || user.email?.split("@")[0] || "Someone",
        email: user.email,
        sentAt: Date.now(),
      });
      setAddSuccess(`Friend request sent to ${friendProfile.name}!`);
      setAddEmail("");
    } catch (e) {
      console.error("Friend request error:", e);
      setAddError("Something went wrong. Try again.");
    }
    setAddLoading(false);
  };

  // Accept friend request
  const acceptRequest = async (req) => {
    try {
      // Add to both users' friends lists
      await setDoc(doc(db, "profiles", user.uid, "friends", req.uid), {
        uid: req.uid, name: req.name, email: req.email,
      });
      await setDoc(doc(db, "profiles", req.uid, "friends", user.uid), {
        uid: user.uid, name: user.displayName || user.email?.split("@")[0], email: user.email,
      });
      // Remove the request
      await deleteDoc(doc(db, "profiles", user.uid, "friendRequests", req.uid));
    } catch (e) {
      console.error("Accept error:", e);
    }
  };

  // Decline friend request
  const declineRequest = async (req) => {
    try {
      await deleteDoc(doc(db, "profiles", user.uid, "friendRequests", req.uid));
    } catch (e) {
      console.error("Decline error:", e);
    }
  };

  // Remove friend
  const removeFriend = async (friend) => {
    try {
      await deleteDoc(doc(db, "profiles", user.uid, "friends", friend.uid));
      await deleteDoc(doc(db, "profiles", friend.uid, "friends", user.uid));
      if (selectedFriend?.uid === friend.uid) { setSelectedFriend(null); setFriendRecipes([]); }
    } catch (e) {
      console.error("Remove friend error:", e);
    }
  };

  // Load friend's recipes
  const viewFriend = async (friend) => {
    setSelectedFriend(friend);
    setViewingRecipe(null);
    setLoadingRecipes(true);
    setFriendWeekOffset(0);
    try {
      const q = query(collection(db, "users", friend.uid, "recipes"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setFriendRecipes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      // Load their meal plan
      const mpSnap = await getDoc(doc(db, "users", friend.uid, "mealplans", "current"));
      setFriendMealPlan(mpSnap.exists() ? mpSnap.data().plan || {} : {});
    } catch (e) {
      console.error("Load friend recipes error:", e);
      setFriendRecipes([]);
    }
    setLoadingRecipes(false);
  };

  const friendWeekKey = getWeekKey(friendWeekOffset);
  const friendWeekDates = getWeekDates(friendWeekOffset);
  const friendPlan = friendMealPlan[friendWeekKey] || {};
  const fWeekLabel = () => {
    const d = friendWeekDates[0]; const end = friendWeekDates[6];
    const fmt = (dt) => dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${fmt(d)} \u2013 ${fmt(end)}`;
  };

  // ── Viewing a friend's kitchen ──
  if (selectedFriend) {
    if (viewingRecipe) {
      const r = viewingRecipe;
      return (
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <button style={styles.backBtn} onClick={() => setViewingRecipe(null)}>{"\u2190"} Back to {selectedFriend.name}'s Kitchen</button>
            <button
              onClick={() => { onCopyRecipe(r); }}
              style={{ ...styles.saveBtn, marginTop: 0, padding: "10px 20px", fontSize: 14 }}
            >Copy to My Kitchen</button>
          </div>
          <div style={styles.detailHero}>
            <span style={styles.detailEmoji}>{r.image || "\ud83c\udf7d\ufe0f"}</span>
            <div>
              <h1 style={styles.detailTitle}>{r.title}</h1>
              <div style={styles.detailMeta}>
                <span style={styles.badge}>{r.category}</span>
                {r.prepTime && <span style={styles.metaItem}>{"\ud83d\udd50"} Prep: {r.prepTime}</span>}
                {r.cookTime && <span style={styles.metaItem}>{"\ud83d\udd25"} Cook: {r.cookTime}</span>}
                {r.servings && <span style={styles.metaItem}>{"\ud83c\udf7d\ufe0f"} Serves: {r.servings}</span>}
              </div>
              <div style={styles.stars}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <span key={s} style={{ ...styles.star, color: s <= r.rating ? "#E8A838" : "#ddd" }}>{"\u2605"}</span>
                ))}
              </div>
            </div>
          </div>
          <div style={styles.detailBody}>
            <div style={styles.detailSection}>
              <h3 style={styles.sectionTitle}>Ingredients</h3>
              <div style={styles.ingredientsList}>
                {r.ingredients?.map((ing, i) => (
                  <div key={i} style={styles.ingredientItem}><span style={styles.dot}>{"\u25cf"}</span><span>{ing}</span></div>
                ))}
              </div>
            </div>
            <div style={styles.detailSection}>
              <h3 style={styles.sectionTitle}>Directions</h3>
              {r.steps?.map((step, i) => (
                <div key={i} style={styles.stepItem}><span style={styles.stepCircle}>{i + 1}</span><p style={styles.stepText}>{step}</p></div>
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
      );
    }

    return (
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <button style={styles.backBtn} onClick={() => { setSelectedFriend(null); setFriendRecipes([]); }}>
          {"\u2190"} Back to Friends
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0 24px" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#F0E6D8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: "#6B5744", border: "2px solid #EDE5DA" }}>
            {selectedFriend.name[0].toUpperCase()}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{selectedFriend.name}'s Kitchen</h2>
            <p style={{ margin: "2px 0 0", fontSize: 14, color: "#A08060" }}>{friendRecipes.length} recipe{friendRecipes.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {loadingRecipes ? (
          <p style={{ color: "#A08060" }}>Loading recipes...</p>
        ) : (
          <>
            {/* Friend's meal plan preview */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{"\ud83d\udcc5"} This Week's Meals</h3>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <button style={{ ...styles.filterChip, padding: "4px 12px", fontSize: 12 }} onClick={() => setFriendWeekOffset(friendWeekOffset - 1)}>{"\u2190"}</button>
                  <span style={{ fontSize: 13, fontWeight: 600, minWidth: 130, textAlign: "center" }}>{fWeekLabel()}</span>
                  <button style={{ ...styles.filterChip, padding: "4px 12px", fontSize: 12 }} onClick={() => setFriendWeekOffset(friendWeekOffset + 1)}>{"\u2192"}</button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
                {DAYS.map((day, di) => {
                  const date = friendWeekDates[di];
                  return (
                    <div key={day} style={{ background: "#FFFDF8", borderRadius: 10, border: "1.5px solid #EDE5DA", padding: 8, minWidth: 100 }}>
                      <div style={{ textAlign: "center", marginBottom: 6, fontSize: 11, fontWeight: 700, color: "#A08060" }}>{day.slice(0, 3)} {date.getDate()}</div>
                      {MEAL_SLOTS.map((slot) => {
                        const meal = friendPlan[day]?.[slot];
                        return meal ? (
                          <div key={slot} style={{ background: "#F0E6D8", borderRadius: 6, padding: "3px 6px", fontSize: 10, fontWeight: 600, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {meal.image} {meal.title}
                          </div>
                        ) : null;
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Friend's recipes grid */}
            <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>{"\ud83d\udcd6"} Recipes</h3>
            {friendRecipes.length === 0 ? (
              <p style={{ color: "#A08060", fontSize: 14 }}>{selectedFriend.name} hasn't added any recipes yet.</p>
            ) : (
              <div style={styles.grid}>
                {friendRecipes.map((r) => (
                  <div key={r.id} style={styles.card} onClick={() => setViewingRecipe(r)}>
                    <div style={styles.cardTop}>
                      <span style={styles.cardEmoji}>{r.image || "\ud83c\udf7d\ufe0f"}</span>
                      <span style={styles.cardBadge}>{r.category}</span>
                    </div>
                    <h3 style={styles.cardTitle}>{r.title}</h3>
                    <div style={styles.cardMeta}>
                      {r.prepTime && <span>{"\ud83d\udd50"} {r.prepTime}</span>}
                      {r.cookTime && <span>{"\ud83d\udd25"} {r.cookTime}</span>}
                    </div>
                    <div style={styles.cardStars}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <span key={s} style={{ color: s <= r.rating ? "#E8A838" : "#ddd", fontSize: 14 }}>{"\u2605"}</span>
                      ))}
                    </div>
                    <p style={styles.cardIngredients}>
                      {r.ingredients?.slice(0, 3).join(" \u00b7 ")}{(r.ingredients?.length || 0) > 3 ? " ..." : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ── Friends list view ──
  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 800 }}>{"\ud83d\udc65"} Friends' Kitchens</h2>
      <p style={{ margin: "0 0 24px", fontSize: 14, color: "#A08060" }}>Browse your friends' recipes and see what they're cooking.</p>

      {/* Add Friend */}
      <div style={{ background: "#FFFDF8", borderRadius: 14, border: "2px solid #EDE5DA", padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 700 }}>Add a Friend</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ ...styles.input, flex: 1 }}
            placeholder="Enter their email address..."
            value={addEmail}
            onChange={(e) => { setAddEmail(e.target.value); setAddError(""); setAddSuccess(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") sendRequest(); }}
          />
          <button onClick={sendRequest} disabled={addLoading || !addEmail.trim()} style={{ ...styles.saveBtn, marginTop: 0, padding: "10px 20px", fontSize: 14, opacity: addLoading || !addEmail.trim() ? 0.5 : 1 }}>
            {addLoading ? "..." : "Send"}
          </button>
        </div>
        {addError && <p style={{ color: "#C75B2A", fontSize: 13, marginTop: 8, marginBottom: 0 }}>{addError}</p>}
        {addSuccess && <p style={{ color: "#5a8a5a", fontSize: 13, marginTop: 8, marginBottom: 0 }}>{addSuccess}</p>}
      </div>

      {/* Friend Requests */}
      {requests.length > 0 && (
        <div style={{ background: "#FFF5EB", borderRadius: 14, border: "2px solid #E8DDD0", padding: 20, marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>Friend Requests ({requests.length})</h3>
          {requests.map((req) => (
            <div key={req.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #EDE5DA" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{req.name}</div>
                <div style={{ fontSize: 12, color: "#A08060" }}>{req.email}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => acceptRequest(req)} style={{ ...styles.saveBtn, marginTop: 0, padding: "6px 16px", fontSize: 13 }}>Accept</button>
                <button onClick={() => declineRequest(req)} style={{ ...styles.filterChip, padding: "6px 16px", fontSize: 13 }}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Friends List */}
      <div>
        <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>Your Friends ({friendsList.length})</h3>
        {friendsList.length === 0 ? (
          <div style={{ background: "#FFFDF8", borderRadius: 14, border: "2px solid #EDE5DA", padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>{"\ud83d\udc65"}</div>
            <p style={{ color: "#A08060", fontSize: 14, margin: 0 }}>No friends yet. Send an invite above to get started!</p>
          </div>
        ) : (
          friendsList.map((friend) => (
            <div key={friend.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#FFFDF8", borderRadius: 12, border: "2px solid #EDE5DA", padding: "14px 18px", marginBottom: 8, cursor: "pointer", transition: "box-shadow 0.15s" }}
              onClick={() => viewFriend(friend)}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = "0 2px 8px rgba(61,46,31,0.1)"}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = "none"}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#F0E6D8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#6B5744" }}>
                  {friend.name[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{friend.name}</div>
                  <div style={{ fontSize: 12, color: "#A08060" }}>View their kitchen {"\u2192"}</div>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeFriend(friend); }}
                style={{ background: "none", border: "1px solid #E8DDD0", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#A08060", cursor: "pointer", fontFamily: "inherit" }}
              >Remove</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── MEAL PLANNER COMPONENT ──
function MealPlanner({ recipes, mealPlan, saveMealPlan, checkedGrocery, saveCheckedGrocery }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [picker, setPicker] = useState(null);
  const [pickedRecipe, setPickedRecipe] = useState(null);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [pickerCategory, setPickerCategory] = useState("All");
  const [checkedItems, setCheckedItems] = useState({});
  const [itemPrices, setItemPrices] = useState({});
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pricesError, setPricesError] = useState("");
  const [pricesFetched, setPricesFetched] = useState(false);

  const weekKey = getWeekKey(weekOffset);
  const weekDates = getWeekDates(weekOffset);
  const plan = mealPlan[weekKey] || {};
  const checkedForWeek = checkedGrocery[weekKey] || {};

  const weekLabel = () => {
    const d = weekDates[0]; const end = weekDates[6];
    const fmt = (dt) => dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${fmt(d)} \u2013 ${fmt(end)}`;
  };

  const assignMeal = (day, slot, recipe) => {
    const updated = { ...mealPlan };
    if (!updated[weekKey]) updated[weekKey] = {};
    if (!updated[weekKey][day]) updated[weekKey][day] = {};
    updated[weekKey][day][slot] = { id: recipe.id, title: recipe.title, image: recipe.image || "\ud83c\udf7d\ufe0f", multiplier: 1 };
    saveMealPlan(updated);
    setPicker(null); setPickedRecipe(null); setSelectedSlots([]); setSearchTerm("");
  };

  const assignMultiple = (recipe, slots) => {
    const updated = { ...mealPlan };
    if (!updated[weekKey]) updated[weekKey] = {};
    slots.forEach(({ day, slot }) => {
      if (!updated[weekKey][day]) updated[weekKey][day] = {};
      updated[weekKey][day][slot] = { id: recipe.id, title: recipe.title, image: recipe.image || "\ud83c\udf7d\ufe0f", multiplier: 1 };
    });
    saveMealPlan(updated);
    setPicker(null); setPickedRecipe(null); setSelectedSlots([]); setSearchTerm("");
  };

  const toggleSlotSelection = (day, slot) => {
    const exists = selectedSlots.find((s) => s.day === day && s.slot === slot);
    if (exists) setSelectedSlots(selectedSlots.filter((s) => !(s.day === day && s.slot === slot)));
    else setSelectedSlots([...selectedSlots, { day, slot }]);
  };

  const isSlotSelected = (day, slot) => selectedSlots.some((s) => s.day === day && s.slot === slot);
  const isSlotTaken = (day, slot) => !!plan[day]?.[slot];

  const cycleMultiplier = (day, slot) => {
    const updated = { ...mealPlan };
    const meal = updated[weekKey]?.[day]?.[slot];
    if (!meal) return;
    const current = meal.multiplier || 1;
    const idx = MULTIPLIERS.indexOf(current);
    const next = MULTIPLIERS[(idx + 1) % MULTIPLIERS.length];
    updated[weekKey][day][slot] = { ...meal, multiplier: next };
    saveMealPlan(updated);
  };

  const removeMeal = (day, slot) => {
    const updated = { ...mealPlan };
    if (updated[weekKey]?.[day]?.[slot]) { delete updated[weekKey][day][slot]; saveMealPlan(updated); }
  };

  const clearWeek = () => {
    const updated = { ...mealPlan }; delete updated[weekKey]; saveMealPlan(updated);
    const updatedChecked = { ...checkedGrocery }; delete updatedChecked[weekKey]; saveCheckedGrocery(updatedChecked);
  };

  // Smart grocery list with merging
  const UNIT_MAP = {
    "tsp": "tsp", "teaspoon": "tsp", "teaspoons": "tsp",
    "tbsp": "tbsp", "tablespoon": "tbsp", "tablespoons": "tbsp",
    "cup": "cup", "cups": "cup",
    "oz": "oz", "ounce": "oz", "ounces": "oz",
    "lb": "lb", "lbs": "lb", "pound": "lb", "pounds": "lb",
    "g": "g", "gram": "g", "grams": "g", "kg": "kg",
    "ml": "ml", "l": "l", "pinch": "pinch", "pinches": "pinch",
    "clove": "clove", "cloves": "clove", "slice": "slice", "slices": "slice",
    "piece": "piece", "pieces": "piece", "can": "can", "cans": "can",
    "stick": "stick", "sticks": "stick", "large": "large", "medium": "medium", "small": "small",
  };
  const fractionMap2 = { "\u00bd": 0.5, "\u2153": 0.33, "\u2154": 0.67, "\u00bc": 0.25, "\u00be": 0.75 };

  function parseIngredient(raw) {
    let text = raw.trim();
    for (const [frac, val] of Object.entries(fractionMap2)) text = text.replace(frac, String(val));
    const numPattern = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+\.?\d*)\s*/;
    const match = text.match(numPattern);
    let amount = 0, rest = text;
    if (match) {
      const numStr = match[1];
      if (numStr.includes(" ") && numStr.includes("/")) {
        const parts = numStr.split(/\s+/); const [n, d] = parts[1].split("/").map(Number);
        amount = parseInt(parts[0]) + n / d;
      } else if (numStr.includes("/")) { const [n, d] = numStr.split("/").map(Number); amount = n / d; }
      else amount = parseFloat(numStr);
      rest = text.slice(match[0].length);
    }
    let unit = "";
    const unitMatch = rest.match(/^(\S+)\s+/);
    if (unitMatch) {
      const candidate = unitMatch[1].toLowerCase().replace(/[.,]/g, "");
      const parenMatch = rest.match(/^\(.*?\)\s*/);
      if (parenMatch) {
        rest = rest.slice(parenMatch[0].length);
        const innerUnitMatch = rest.match(/^(\S+)\s+/);
        if (innerUnitMatch && UNIT_MAP[innerUnitMatch[1].toLowerCase().replace(/[.,]/g, "")]) {
          unit = UNIT_MAP[innerUnitMatch[1].toLowerCase().replace(/[.,]/g, "")];
          rest = rest.slice(innerUnitMatch[0].length);
        }
      } else if (UNIT_MAP[candidate]) { unit = UNIT_MAP[candidate]; rest = rest.slice(unitMatch[0].length); }
    }
    const name = rest.replace(/^(of\s+)/i, "").trim().toLowerCase().replace(/,.*$/, "").replace(/\(.*?\)/g, "").trim();
    return { amount, unit, name, originalName: rest.trim() };
  }

  const groceryItems = (() => {
    const merged = new Map();
    DAYS.forEach((day) => {
      MEAL_SLOTS.forEach((slot) => {
        const meal = plan[day]?.[slot];
        if (meal) {
          const recipe = recipes.find((r) => r.id === meal.id);
          const mult = meal.multiplier || 1;
          if (recipe?.ingredients) {
            recipe.ingredients.forEach((ing) => {
              const parsed = parseIngredient(ing);
              const key = parsed.name || ing.toLowerCase().trim();
              if (!key) return;
              if (!merged.has(key)) merged.set(key, { amounts: [], originalName: parsed.originalName || ing, from: [] });
              const entry = merged.get(key);
              entry.amounts.push({ amount: parsed.amount * mult, unit: parsed.unit });
              if (!entry.from.includes(recipe.title)) entry.from.push(recipe.title);
            });
          }
        }
      });
    });
    const items = [];
    for (const [key, entry] of merged) {
      const byUnit = {}; let hasAnyAmount = false;
      entry.amounts.forEach(({ amount, unit }) => {
        if (amount > 0) { hasAnyAmount = true; const u = unit || "_bare"; byUnit[u] = (byUnit[u] || 0) + amount; }
      });
      let display;
      if (!hasAnyAmount) display = entry.originalName;
      else {
        const parts = [];
        for (const [u, total] of Object.entries(byUnit)) {
          const fmt = total % 1 === 0 ? String(total) : total.toFixed(1).replace(/\.0$/, "");
          parts.push(u === "_bare" ? fmt : `${fmt} ${u}`);
        }
        display = parts.join(" + ") + " " + entry.originalName;
      }
      items.push({ text: display, from: entry.from.join(", ") });
    }
    return items;
  })();

  const toggleCheck = (idx) => {
    const updated = { ...checkedGrocery };
    if (!updated[weekKey]) updated[weekKey] = {};
    updated[weekKey][idx] = !checkedForWeek[idx];
    saveCheckedGrocery(updated);
  };

  const filteredRecipes = recipes.filter((r) => {
    const matchesSearch = !searchTerm || r.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = pickerCategory === "All" || r.category === pickerCategory;
    return matchesSearch && matchesCategory;
  });

  const assignedCount = DAYS.reduce((acc, day) => acc + MEAL_SLOTS.reduce((a, slot) => a + (plan[day]?.[slot] ? 1 : 0), 0), 0);

  const fetchPrices = async () => {
    if (groceryItems.length === 0) return;
    setPricesLoading(true);
    setPricesError("");
    setItemPrices({});
    setPricesFetched(false);
    try {
      const itemList = groceryItems.map((item, i) => `${i}: ${item.text}`).join("\n");
      const prompt = `You are a grocery price estimator. For each item below, search the web for current typical US grocery store prices (check sites like Instacart, Kroger, Walmart Grocery, or similar). Return ONLY a JSON object where keys are the item index numbers and values are estimated price in USD as a number (e.g. {"0": 2.49, "1": 1.99}). Use realistic current prices. If you cannot determine a price for an item, use null.

Items:
${itemList}`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: prompt }],
          system: "You are a grocery price assistant. Always respond with only a valid JSON object mapping item indices to prices. No markdown, no explanation — just the JSON."
        })
      });
      const data = await response.json();
      // Find the last text block (after tool use)
      const textBlocks = (data.content || []).filter(b => b.type === "text");
      const raw = textBlocks[textBlocks.length - 1]?.text || "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Could not parse prices.");
      const parsed = JSON.parse(jsonMatch[0]);
      setItemPrices(parsed);
      setPricesFetched(true);
    } catch (e) {
      console.error("Price fetch error:", e);
      setPricesError("Couldn't fetch prices. Try again.");
    }
    setPricesLoading(false);
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{"\ud83d\udcc5"} Meal Planner</h2>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: "#A08060" }}>{assignedCount} meal{assignedCount !== 1 ? "s" : ""} planned this week</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button style={styles.filterChip} onClick={() => setWeekOffset(weekOffset - 1)}>{"\u2190"} Prev</button>
          <span style={{ fontSize: 15, fontWeight: 600, minWidth: 160, textAlign: "center" }}>{weekLabel()}</span>
          <button style={styles.filterChip} onClick={() => setWeekOffset(weekOffset + 1)}>Next {"\u2192"}</button>
          {assignedCount > 0 && <button style={{ ...styles.filterChip, color: "#C75B2A", borderColor: "#C75B2A" }} onClick={clearWeek}>Clear Week</button>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginBottom: 32, overflowX: "auto" }}>
        {DAYS.map((day, di) => {
          const date = weekDates[di]; const isToday = new Date().toDateString() === date.toDateString();
          return (
            <div key={day} style={{ background: isToday ? "#FFF5EB" : "#FFFDF8", borderRadius: 14, border: isToday ? "2px solid #C75B2A" : "2px solid #EDE5DA", padding: 10, minWidth: 130 }}>
              <div style={{ textAlign: "center", marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid #EDE5DA" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: isToday ? "#C75B2A" : "#A08060", textTransform: "uppercase", letterSpacing: "0.5px" }}>{day.slice(0, 3)}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: isToday ? "#C75B2A" : "#3D2E1F" }}>{date.getDate()}</div>
              </div>
              {MEAL_SLOTS.map((slot) => {
                const meal = plan[day]?.[slot];
                return (
                  <div key={slot} style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#A08060", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>{slot}</div>
                    {meal ? (
                      <div style={{ background: "#F0E6D8", borderRadius: 8, padding: "6px 8px", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                        <span>{meal.image}</span>
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meal.title}</span>
                        <button onClick={(e) => { e.stopPropagation(); cycleMultiplier(day, slot); }} title="Click to change serving multiplier" style={{ background: (meal.multiplier || 1) !== 1 ? "#C75B2A" : "#BFB09E", color: "#fff", border: "none", borderRadius: 4, padding: "1px 4px", fontSize: 9, fontWeight: 700, cursor: "pointer", lineHeight: 1.4, flexShrink: 0 }}>{(meal.multiplier || 1)}x</button>
                        <button onClick={() => removeMeal(day, slot)} style={{ background: "none", border: "none", color: "#C75B2A", fontSize: 14, cursor: "pointer", padding: 0, lineHeight: 1 }}>{"\u00d7"}</button>
                      </div>
                    ) : (
                      <button onClick={() => { setPicker({ day, slot }); setSearchTerm(""); setPickerCategory("All"); }} style={{ width: "100%", background: "transparent", border: "1px dashed #D4C8BA", borderRadius: 8, padding: "6px", fontSize: 16, color: "#D4C8BA", cursor: "pointer", fontFamily: "inherit" }}>+</button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Picker Modal */}
      {picker && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(61,46,31,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={() => { setPicker(null); setPickedRecipe(null); setSelectedSlots([]); }}>
          <div style={{ background: "#FFFDF8", borderRadius: 16, padding: 24, width: "90%", maxWidth: pickedRecipe ? 520 : 440, maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 12px 40px rgba(61,46,31,0.2)" }} onClick={(e) => e.stopPropagation()}>
            {!pickedRecipe ? (
              <>
                <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700 }}>Add {picker.slot} {"\u2014"} {picker.day}</h3>
                <p style={{ margin: "0 0 12px", fontSize: 13, color: "#A08060" }}>Pick a recipe from your collection</p>
                <input style={{ ...styles.input, marginBottom: 8 }} placeholder="Search recipes..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} autoFocus />
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
                  {["All", ...CATEGORIES].map((c) => (
                    <button key={c} onClick={() => setPickerCategory(c)} style={{ padding: "3px 10px", border: "1.5px solid #E8DDD0", borderRadius: 14, background: pickerCategory === c ? "#3D2E1F" : "transparent", color: pickerCategory === c ? "#FDF6EC" : "#6B5744", borderColor: pickerCategory === c ? "#3D2E1F" : "#E8DDD0", fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>{c}</button>
                  ))}
                </div>
                <div style={{ overflow: "auto", flex: 1 }}>
                  {filteredRecipes.length === 0 ? <p style={{ textAlign: "center", color: "#A08060", fontSize: 14 }}>No recipes found.</p> : filteredRecipes.map((r) => (
                    <div key={r.id} onClick={() => { setPickedRecipe(r); setSelectedSlots([{ day: picker.day, slot: picker.slot }]); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, cursor: "pointer", border: "1px solid #EDE5DA", marginBottom: 6, transition: "background 0.1s" }} onMouseEnter={(e) => e.currentTarget.style.background = "#F8F0E4"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                      <span style={{ fontSize: 24 }}>{r.image || "\ud83c\udf7d\ufe0f"}</span>
                      <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600 }}>{r.title}</div><div style={{ fontSize: 12, color: "#A08060" }}>{r.category} {r.cookTime ? `\u00b7 ${r.cookTime}` : ""}</div></div>
                    </div>
                  ))}
                </div>
                <button onClick={() => { setPicker(null); setPickedRecipe(null); setSelectedSlots([]); }} style={{ ...styles.filterChip, marginTop: 12, alignSelf: "center" }}>Cancel</button>
              </>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 28 }}>{pickedRecipe.image || "\ud83c\udf7d\ufe0f"}</span>
                  <div><h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{pickedRecipe.title}</h3><p style={{ margin: "2px 0 0", fontSize: 13, color: "#A08060" }}>Select which slots to add this to</p></div>
                </div>
                <div style={{ overflow: "auto", flex: 1, marginTop: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
                    {DAYS.map((day) => (
                      <div key={day} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#A08060", marginBottom: 6 }}>{day.slice(0, 3)}</div>
                        {MEAL_SLOTS.map((slot) => {
                          const taken = isSlotTaken(day, slot); const selected = isSlotSelected(day, slot);
                          return (
                            <div key={slot} onClick={() => !taken && toggleSlotSelection(day, slot)} style={{ padding: "6px 2px", marginBottom: 4, borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: taken ? "default" : "pointer", background: selected ? "#C75B2A" : taken ? "#F0E6D8" : "#FFFDF8", color: selected ? "#fff" : taken ? "#C0A888" : "#6B5744", border: selected ? "2px solid #C75B2A" : "2px solid #EDE5DA", opacity: taken ? 0.5 : 1, transition: "all 0.1s", textTransform: "uppercase", letterSpacing: "0.3px" }}>
                              {taken ? "\u2713" : slot.slice(0, 3)}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 16, alignItems: "center" }}>
                  <button onClick={() => { setPickedRecipe(null); setSelectedSlots([]); }} style={styles.filterChip}>{"\u2190"} Back</button>
                  <span style={{ fontSize: 13, color: "#A08060" }}>{selectedSlots.length} slot{selectedSlots.length !== 1 ? "s" : ""} selected</span>
                  <button onClick={() => assignMultiple(pickedRecipe, selectedSlots)} disabled={selectedSlots.length === 0} style={{ ...styles.saveBtn, marginTop: 0, padding: "10px 20px", fontSize: 14, opacity: selectedSlots.length === 0 ? 0.5 : 1 }}>Add to {selectedSlots.length} slot{selectedSlots.length !== 1 ? "s" : ""}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Grocery List */}
      <div style={{ background: "#FFFDF8", borderRadius: 16, border: "2px solid #EDE5DA", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{"\ud83d\uded2"} Grocery List</h3>
            {groceryItems.length > 0 && <span style={{ fontSize: 13, color: "#A08060" }}>{Object.values(checkedForWeek).filter(Boolean).length} / {groceryItems.length} items</span>}
          </div>
          {groceryItems.length > 0 && (
            <button
              onClick={fetchPrices}
              disabled={pricesLoading}
              style={{ background: pricesLoading ? "#D4C8BA" : "#3D2E1F", color: "#FDF6EC", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: pricesLoading ? "wait" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, transition: "opacity 0.15s" }}
            >
              {pricesLoading ? (
                <><span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid #FDF6EC", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> Searching prices…</>
              ) : (
                <>{"\ud83d\udcb0"} {pricesFetched ? "Refresh Prices" : "Get Prices"}</>
              )}
            </button>
          )}
        </div>

        {pricesError && <p style={{ color: "#C75B2A", fontSize: 13, margin: "0 0 12px" }}>{pricesError}</p>}

        {groceryItems.length === 0 ? (
          <p style={{ color: "#A08060", fontSize: 14, margin: 0 }}>Assign meals to the calendar above and your grocery list will auto-populate here.</p>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {groceryItems.map((item, i) => {
                const price = itemPrices[String(i)];
                return (
                  <div key={i} onClick={() => toggleCheck(i)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, cursor: "pointer", background: checkedForWeek[i] ? "#F0E6D8" : "transparent", transition: "background 0.1s" }}>
                    <span style={{ width: 20, height: 20, borderRadius: 6, border: checkedForWeek[i] ? "2px solid #C75B2A" : "2px solid #D4C8BA", background: checkedForWeek[i] ? "#C75B2A" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{checkedForWeek[i] ? "\u2713" : ""}</span>
                    <span style={{ flex: 1, fontSize: 15, textDecoration: checkedForWeek[i] ? "line-through" : "none", color: checkedForWeek[i] ? "#A08060" : "#3D2E1F" }}>{item.text}</span>
                    <span style={{ fontSize: 11, color: "#C0A888", flexShrink: 0, marginRight: 4 }}>{item.from}</span>
                    {pricesFetched && (
                      <span style={{ fontSize: 13, fontWeight: 700, color: price != null ? "#3D7A3D" : "#C0A888", background: price != null ? "#EAF5EA" : "#F5F0EB", borderRadius: 6, padding: "2px 8px", flexShrink: 0, minWidth: 48, textAlign: "right" }}>
                        {price != null ? `$${Number(price).toFixed(2)}` : "—"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {pricesFetched && (() => {
              const total = groceryItems.reduce((sum, _, i) => {
                const p = itemPrices[String(i)];
                return sum + (p != null ? Number(p) : 0);
              }, 0);
              const priced = groceryItems.filter((_, i) => itemPrices[String(i)] != null).length;
              return (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: "2px solid #EDE5DA", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "#A08060" }}>Estimated total ({priced}/{groceryItems.length} items priced)</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "#3D2E1F" }}>${total.toFixed(2)}</span>
                </div>
              );
            })()}

            {pricesFetched && (
              <p style={{ fontSize: 11, color: "#C0A888", margin: "8px 0 0", lineHeight: 1.5 }}>
                💡 Prices sourced live via web search. Actual costs may vary by store and region.
              </p>
            )}
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── MAIN APP ──
export default function RecipeTracker() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [recipes, setRecipes] = useState([]);
  const [tab, setTab] = useState("recipes");
  const [view, setView] = useState("grid");
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [formData, setFormData] = useState({ ...EMPTY_RECIPE });
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [loaded, setLoaded] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [mealPlan, setMealPlan] = useState({});
  const [checkedGrocery, setCheckedGrocery] = useState({});
  const [showImport, setShowImport] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      // Ensure profile exists for friends lookup
      if (u) {
        setDoc(doc(db, "profiles", u.uid), {
          name: u.displayName || u.email?.split("@")[0] || "User",
          email: (u.email || "").toLowerCase(),
          uid: u.uid,
        }, { merge: true }).catch(() => {});
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) { setRecipes([]); setLoaded(false); return; }
    const q = query(collection(db, "users", user.uid, "recipes"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecipes(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoaded(true);
    }, () => { setRecipes([]); setLoaded(true); });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) { setMealPlan({}); return; }
    const unsubscribe = onSnapshot(doc(db, "users", user.uid, "mealplans", "current"), (snapshot) => {
      setMealPlan(snapshot.exists() ? snapshot.data().plan || {} : {});
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) { setCheckedGrocery({}); return; }
    const unsubscribe = onSnapshot(doc(db, "users", user.uid, "mealplans", "checkedGrocery"), (snapshot) => {
      setCheckedGrocery(snapshot.exists() ? snapshot.data().checked || {} : {});
    });
    return () => unsubscribe();
  }, [user]);

  const saveRecipe = useCallback(async (recipe) => {
    if (!user) return;
    try { const { id, ...data } = recipe; await setDoc(doc(db, "users", user.uid, "recipes", id), { ...data, id }); } catch (e) { console.error("Save error:", e); }
  }, [user]);

  const removeRecipe = useCallback(async (id) => {
    if (!user) return;
    try { await deleteDoc(doc(db, "users", user.uid, "recipes", id)); } catch (e) { console.error("Delete error:", e); }
  }, [user]);

  const saveMealPlan = useCallback(async (plan) => {
    if (!user) return;
    setMealPlan(plan);
    try { await setDoc(doc(db, "users", user.uid, "mealplans", "current"), { plan }); } catch (e) { console.error("Meal plan save error:", e); }
  }, [user]);

  const saveCheckedGrocery = useCallback(async (checked) => {
    if (!user) return;
    setCheckedGrocery(checked);
    try { await setDoc(doc(db, "users", user.uid, "mealplans", "checkedGrocery"), { checked }); } catch (e) { console.error("Checked grocery save error:", e); }
  }, [user]);

  const handleSignOut = async () => {
    try { await signOut(auth); setTab("recipes"); setView("grid"); } catch (e) { console.error("Sign out error:", e); }
  };

  const filteredRecipes = recipes.filter((r) => {
    const matchesSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.ingredients.some((i) => i.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = filterCategory === "All" || r.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSave = async () => {
    if (!formData.title.trim()) return;
    const cleaned = { ...formData, ingredients: formData.ingredients.filter((i) => i.trim()), steps: formData.steps.filter((s) => s.trim()) };
    if (editingId) {
      const existing = recipes.find((r) => r.id === editingId);
      await saveRecipe({ ...cleaned, id: editingId, createdAt: existing?.createdAt || Date.now() });
    } else {
      await saveRecipe({ ...cleaned, id: `r-${Date.now()}`, createdAt: Date.now() });
    }
    setView("grid"); setEditingId(null); setFormData({ ...EMPTY_RECIPE });
  };

  const handleDelete = async (id) => { await removeRecipe(id); setView("grid"); setSelectedRecipe(null); setDeleteConfirm(null); };
  const handleEdit = (recipe) => { setFormData({ ...recipe }); setEditingId(recipe.id); setView("form"); };
  const openDetail = (recipe) => { setSelectedRecipe(recipe); setView("detail"); };
  const addListItem = (field) => { setFormData({ ...formData, [field]: [...formData[field], ""] }); };
  const updateListItem = (field, index, value) => { const updated = [...formData[field]]; updated[index] = value; setFormData({ ...formData, [field]: updated }); };
  const removeListItem = (field, index) => { if (formData[field].length <= 1) return; setFormData({ ...formData, [field]: formData[field].filter((_, i) => i !== index) }); };
  const handleRating = (recipe, rating) => { saveRecipe({ ...recipe, rating }); if (selectedRecipe?.id === recipe.id) setSelectedRecipe({ ...recipe, rating }); };

  const handleImport = async () => {
    if (!importUrl.trim()) return;
    setImportLoading(true); setImportError("");
    try {
      const resp = await fetch("/api/scrape-recipe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: importUrl.trim() }) });
      const result = await resp.json();
      if (result.error) { setImportError(result.error); setImportLoading(false); return; }
      const data = result.data;
      setFormData({ ...EMPTY_RECIPE, title: data.title || "", ingredients: data.ingredients?.length ? data.ingredients : [""], steps: data.steps?.length ? data.steps : [""], prepTime: data.prepTime || "", cookTime: data.cookTime || "", servings: data.servings || "", notes: data.notes || "", category: data.category || "Healthy Dinner" });
      setEditingId(null); setShowImport(false); setImportUrl(""); setView("form");
    } catch (e) { setImportError("Something went wrong. Check the URL and try again."); }
    setImportLoading(false);
  };

  // Copy a friend's recipe into own kitchen
  const copyFriendRecipe = async (recipe) => {
    const newRecipe = { ...recipe, id: `r-${Date.now()}`, createdAt: Date.now(), rating: 0 };
    delete newRecipe.id;
    const id = `r-${Date.now()}`;
    await saveRecipe({ ...newRecipe, id });
    setTab("recipes"); setView("grid");
  };

  if (authLoading) return <div style={styles.loadingWrap}><div style={styles.loadingText}>Loading...</div></div>;
  if (!user) return <LoginScreen />;
  if (!loaded) return <div style={styles.loadingWrap}><div style={styles.loadingText}>Loading your recipes...</div></div>;

  const TabNav = () => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
      <div style={{ ...styles.tabBar, maxWidth: 480 }}>
        <button style={{ ...styles.tabBtn, ...(tab === "recipes" ? styles.tabBtnActive : {}) }} onClick={() => { setTab("recipes"); setView("grid"); }}>{"\ud83d\udcd6"} Recipes</button>
        <button style={{ ...styles.tabBtn, ...(tab === "planner" ? styles.tabBtnActive : {}) }} onClick={() => setTab("planner")}>{"\ud83d\udcc5"} Meal Planner</button>
        <button style={{ ...styles.tabBtn, ...(tab === "friends" ? styles.tabBtnActive : {}) }} onClick={() => setTab("friends")}>{"\ud83d\udc65"} Friends</button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #EDE5DA", background: "#F0E6D8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#6B5744", overflow: "hidden" }}>
          {user.photoURL ? <img src={user.photoURL} alt="" style={{ width: 32, height: 32 }} referrerPolicy="no-referrer" /> : (user.displayName || user.email || "?")[0].toUpperCase()}
        </div>
        <span style={{ fontSize: 13, color: "#6B5744", fontWeight: 500 }}>{user.displayName?.split(" ")[0] || user.email?.split("@")[0]}</span>
        <button onClick={handleSignOut} style={{ background: "none", border: "1px solid #E8DDD0", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "#A08060", cursor: "pointer", fontFamily: "inherit" }}>Sign out</button>
      </div>
    </div>
  );

  if (tab === "friends") {
    return (
      <div style={styles.app}>
        <TabNav />
        <FriendsKitchen user={user} onCopyRecipe={copyFriendRecipe} />
      </div>
    );
  }

  if (tab === "planner") {
    return (
      <div style={styles.app}>
        <TabNav />
        <MealPlanner recipes={recipes} mealPlan={mealPlan} saveMealPlan={saveMealPlan} checkedGrocery={checkedGrocery} saveCheckedGrocery={saveCheckedGrocery} />
      </div>
    );
  }

  if (view === "form") {
    return (
      <div style={styles.app}>
        <TabNav />
        <div style={styles.formContainer}>
          <div style={styles.formHeader}>
            <button style={styles.backBtn} onClick={() => { setView("grid"); setEditingId(null); setFormData({ ...EMPTY_RECIPE }); }}>{"\u2190"} Back</button>
            <h2 style={styles.formTitle}>{editingId ? "Edit Recipe" : "New Recipe"}</h2>
          </div>
          <div style={styles.formGrid}>
            <div style={styles.emojiSection}>
              <div style={styles.emojiDisplay} onClick={() => setShowEmojiPicker(!showEmojiPicker)}>{formData.image || "\ud83c\udf7d\ufe0f"}</div>
              {showEmojiPicker && <div style={styles.emojiGrid}>{FOOD_EMOJIS.map((e) => <span key={e} style={styles.emojiOption} onClick={() => { setFormData({ ...formData, image: e }); setShowEmojiPicker(false); }}>{e}</span>)}</div>}
            </div>
            <div style={styles.formField}><label style={styles.label}>Recipe Title *</label><input style={styles.input} value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="e.g. Grandma's Sunday Roast" /></div>
            <div style={styles.formRow}>
              <div style={styles.formField}><label style={styles.label}>Category</label><select style={styles.select} value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
              <div style={styles.formField}><label style={styles.label}>Servings</label><input style={styles.input} value={formData.servings} onChange={(e) => setFormData({ ...formData, servings: e.target.value })} placeholder="4" /></div>
            </div>
            <div style={styles.formRow}>
              <div style={styles.formField}><label style={styles.label}>Prep Time</label><input style={styles.input} value={formData.prepTime} onChange={(e) => setFormData({ ...formData, prepTime: e.target.value })} placeholder="15 min" /></div>
              <div style={styles.formField}><label style={styles.label}>Cook Time</label><input style={styles.input} value={formData.cookTime} onChange={(e) => setFormData({ ...formData, cookTime: e.target.value })} placeholder="30 min" /></div>
            </div>
            <div style={styles.formField}>
              <label style={styles.label}>Ingredients</label>
              {formData.ingredients.map((ing, i) => (<div key={i} style={styles.listRow}><input style={{ ...styles.input, flex: 1 }} value={ing} onChange={(e) => updateListItem("ingredients", i, e.target.value)} placeholder={`Ingredient ${i + 1}`} />{formData.ingredients.length > 1 && <button style={styles.removeBtn} onClick={() => removeListItem("ingredients", i)}>{"\u00d7"}</button>}</div>))}
              <button style={styles.addBtn} onClick={() => addListItem("ingredients")}>+ Add Ingredient</button>
            </div>
            <div style={styles.formField}>
              <label style={styles.label}>Steps</label>
              {formData.steps.map((step, i) => (<div key={i} style={styles.listRow}><span style={styles.stepNum}>{i + 1}</span><textarea style={{ ...styles.textarea, flex: 1 }} value={step} onChange={(e) => updateListItem("steps", i, e.target.value)} placeholder={`Step ${i + 1}`} rows={2} />{formData.steps.length > 1 && <button style={styles.removeBtn} onClick={() => removeListItem("steps", i)}>{"\u00d7"}</button>}</div>))}
              <button style={styles.addBtn} onClick={() => addListItem("steps")}>+ Add Step</button>
            </div>
            <div style={styles.formField}><label style={styles.label}>Notes</label><textarea style={styles.textarea} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Tips, variations, or stories..." rows={3} /></div>
            <button style={{ ...styles.saveBtn, opacity: formData.title.trim() ? 1 : 0.5 }} onClick={handleSave} disabled={!formData.title.trim()}>{editingId ? "Update Recipe" : "Save Recipe"}</button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "detail" && selectedRecipe) {
    const r = selectedRecipe;
    return (
      <div style={styles.app}>
        <TabNav />
        <div style={styles.detailContainer}>
          <div style={styles.detailTop}>
            <button style={styles.backBtn} onClick={() => setView("grid")}>{"\u2190"} Back</button>
            <div style={styles.detailActions}>
              <button style={styles.editBtn} onClick={() => handleEdit(r)}>Edit</button>
              {deleteConfirm === r.id ? (
                <span style={styles.confirmWrap}><span style={styles.confirmText}>Delete?</span><button style={styles.confirmYes} onClick={() => handleDelete(r.id)}>Yes</button><button style={styles.confirmNo} onClick={() => setDeleteConfirm(null)}>No</button></span>
              ) : <button style={styles.deleteBtn} onClick={() => setDeleteConfirm(r.id)}>Delete</button>}
            </div>
          </div>
          <div style={styles.detailHero}>
            <span style={styles.detailEmoji}>{r.image || "\ud83c\udf7d\ufe0f"}</span>
            <div>
              <h1 style={styles.detailTitle}>{r.title}</h1>
              <div style={styles.detailMeta}>
                <span style={styles.badge}>{r.category}</span>
                {r.prepTime && <span style={styles.metaItem}>{"\ud83d\udd50"} Prep: {r.prepTime}</span>}
                {r.cookTime && <span style={styles.metaItem}>{"\ud83d\udd25"} Cook: {r.cookTime}</span>}
                {r.servings && <span style={styles.metaItem}>{"\ud83c\udf7d\ufe0f"} Serves: {r.servings}</span>}
              </div>
              <div style={styles.stars}>{[1, 2, 3, 4, 5].map((s) => <span key={s} style={{ ...styles.star, color: s <= r.rating ? "#E8A838" : "#ddd", cursor: "pointer" }} onClick={() => handleRating(r, s)}>{"\u2605"}</span>)}</div>
            </div>
          </div>
          <div style={styles.detailBody}>
            <div style={styles.detailSection}><h3 style={styles.sectionTitle}>Ingredients</h3><div style={styles.ingredientsList}>{r.ingredients.map((ing, i) => <div key={i} style={styles.ingredientItem}><span style={styles.dot}>{"\u25cf"}</span><span>{ing}</span></div>)}</div></div>
            <div style={styles.detailSection}><h3 style={styles.sectionTitle}>Directions</h3>{r.steps.map((step, i) => <div key={i} style={styles.stepItem}><span style={styles.stepCircle}>{i + 1}</span><p style={styles.stepText}>{step}</p></div>)}</div>
            {r.notes && <div style={{ ...styles.detailSection, ...styles.notesBox }}><h3 style={styles.sectionTitle}>Chef's Notes</h3><p style={styles.notesText}>{r.notes}</p></div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <TabNav />
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.logo}><span style={styles.logoIcon}>{"\ud83d\udcd6"}</span> {(user.displayName?.split(" ")[0] || user.email?.split("@")[0])}'s Kitchen</h1>
          <p style={styles.subtitle}>{recipes.length} recipe{recipes.length !== 1 ? "s" : ""} saved</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...styles.filterChip, fontWeight: 600, fontSize: 14, padding: "10px 20px" }} onClick={() => { setShowImport(true); setImportUrl(""); setImportError(""); }}>{"\ud83c\udf10"} Import URL</button>
          <button style={styles.newBtn} onClick={() => { setFormData({ ...EMPTY_RECIPE }); setEditingId(null); setView("form"); }}>+ New Recipe</button>
        </div>
      </header>

      {showImport && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(61,46,31,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={() => setShowImport(false)}>
          <div style={{ background: "#FFFDF8", borderRadius: 16, padding: 28, width: "90%", maxWidth: 480, boxShadow: "0 12px 40px rgba(61,46,31,0.2)" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>{"\ud83c\udf10"} Import Recipe from URL</h3>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "#A08060", lineHeight: 1.5 }}>Paste a link from a recipe website and we'll auto-fill the details.</p>
            <input style={{ ...styles.input, width: "100%", boxSizing: "border-box", marginBottom: 12 }} placeholder="https://www.allrecipes.com/recipe/..." value={importUrl} onChange={(e) => setImportUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleImport(); }} autoFocus />
            {importError && <p style={{ color: "#C75B2A", fontSize: 13, margin: "0 0 12px", lineHeight: 1.4 }}>{importError}</p>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowImport(false)} style={styles.filterChip}>Cancel</button>
              <button onClick={handleImport} disabled={importLoading || !importUrl.trim()} style={{ ...styles.saveBtn, marginTop: 0, padding: "10px 24px", fontSize: 14, opacity: importLoading || !importUrl.trim() ? 0.6 : 1 }}>{importLoading ? "Importing..." : "Import Recipe"}</button>
            </div>
            <p style={{ fontSize: 12, color: "#C0A888", marginTop: 16, marginBottom: 0, lineHeight: 1.5 }}>Works best with AllRecipes, Bon App\u00e9tit, Food Network, etc.</p>
          </div>
        </div>
      )}

      <div style={styles.toolbar}>
        <div style={styles.searchWrap}>
          <span style={styles.searchIcon}>{"\ud83d\udd0d"}</span>
          <input style={styles.searchInput} placeholder="Search recipes or ingredients..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button style={styles.clearSearch} onClick={() => setSearch("")}>{"\u00d7"}</button>}
        </div>
        <div style={styles.filters}>{["All", ...CATEGORIES].map((c) => <button key={c} style={{ ...styles.filterChip, ...(filterCategory === c ? styles.filterChipActive : {}) }} onClick={() => setFilterCategory(c)}>{c}</button>)}</div>
      </div>

      {filteredRecipes.length === 0 ? (
        <div style={styles.empty}><span style={styles.emptyIcon}>{"\ud83c\udf73"}</span><p style={styles.emptyText}>{recipes.length === 0 ? "Your recipe box is empty. Add your first recipe!" : "No recipes match your search."}</p></div>
      ) : (
        <div style={styles.grid}>
          {filteredRecipes.map((r) => (
            <div key={r.id} style={styles.card} onClick={() => openDetail(r)}>
              <div style={styles.cardTop}><span style={styles.cardEmoji}>{r.image || "\ud83c\udf7d\ufe0f"}</span><span style={styles.cardBadge}>{r.category}</span></div>
              <h3 style={styles.cardTitle}>{r.title}</h3>
              <div style={styles.cardMeta}>{r.prepTime && <span>{"\ud83d\udd50"} {r.prepTime}</span>}{r.cookTime && <span>{"\ud83d\udd25"} {r.cookTime}</span>}{r.servings && <span>{"\ud83c\udf7d\ufe0f"} {r.servings}</span>}</div>
              <div style={styles.cardStars}>{[1, 2, 3, 4, 5].map((s) => <span key={s} style={{ color: s <= r.rating ? "#E8A838" : "#ddd", fontSize: 14 }}>{"\u2605"}</span>)}</div>
              <p style={styles.cardIngredients}>{r.ingredients.slice(0, 3).join(" \u00b7 ")}{r.ingredients.length > 3 ? " ..." : ""}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── STYLES ──
const styles = {
  app: { fontFamily: "'DM Sans', 'Segoe UI', sans-serif", background: "linear-gradient(145deg, #FDF6EC 0%, #FFF9F0 40%, #F5EDE3 100%)", minHeight: "100vh", padding: "24px", color: "#3D2E1F" },
  loadingWrap: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#FDF6EC" },
  loadingText: { fontFamily: "'DM Sans', sans-serif", fontSize: 18, color: "#A08060" },
  tabBar: { display: "flex", gap: 4, background: "#EDE5DA", borderRadius: 14, padding: 4, maxWidth: 480 },
  tabBtn: { flex: 1, padding: "10px 16px", border: "none", borderRadius: 11, fontSize: 14, fontWeight: 600, cursor: "pointer", background: "transparent", color: "#6B5744", fontFamily: "inherit", transition: "all 0.15s" },
  tabBtnActive: { background: "#FFFDF8", color: "#3D2E1F", boxShadow: "0 1px 4px rgba(61,46,31,0.1)" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 16 },
  headerLeft: {},
  logo: { fontSize: 28, fontWeight: 800, color: "#3D2E1F", margin: 0, letterSpacing: "-0.5px" },
  logoIcon: { fontSize: 26 },
  subtitle: { margin: "4px 0 0", fontSize: 14, color: "#A08060", fontWeight: 400 },
  newBtn: { background: "#C75B2A", color: "#fff", border: "none", borderRadius: 12, padding: "12px 24px", fontSize: 15, fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 8px rgba(199,91,42,0.3)", transition: "transform 0.15s" },
  toolbar: { marginBottom: 24 },
  searchWrap: { position: "relative", marginBottom: 12 },
  searchIcon: { position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16 },
  searchInput: { width: "100%", boxSizing: "border-box", padding: "12px 40px 12px 42px", border: "2px solid #E8DDD0", borderRadius: 12, fontSize: 15, background: "#FFFDF8", color: "#3D2E1F", outline: "none", fontFamily: "inherit" },
  clearSearch: { position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#A08060" },
  filters: { display: "flex", gap: 8, flexWrap: "wrap" },
  filterChip: { padding: "6px 16px", border: "2px solid #E8DDD0", borderRadius: 20, background: "transparent", fontSize: 13, fontWeight: 500, cursor: "pointer", color: "#6B5744", fontFamily: "inherit", transition: "all 0.15s" },
  filterChipActive: { background: "#3D2E1F", color: "#FDF6EC", borderColor: "#3D2E1F" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 },
  card: { background: "#FFFDF8", borderRadius: 16, padding: 20, border: "2px solid #EDE5DA", cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s", boxShadow: "0 1px 4px rgba(61,46,31,0.06)" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  cardEmoji: { fontSize: 36 },
  cardBadge: { background: "#F0E6D8", color: "#6B5744", padding: "4px 12px", borderRadius: 12, fontSize: 12, fontWeight: 600 },
  cardTitle: { fontSize: 18, fontWeight: 700, margin: "0 0 8px", lineHeight: 1.3 },
  cardMeta: { display: "flex", gap: 12, fontSize: 13, color: "#A08060", marginBottom: 8 },
  cardStars: { marginBottom: 8 },
  cardIngredients: { fontSize: 13, color: "#A08060", margin: 0, lineHeight: 1.5 },
  empty: { textAlign: "center", padding: "60px 20px" },
  emptyIcon: { fontSize: 48, display: "block", marginBottom: 12 },
  emptyText: { fontSize: 16, color: "#A08060" },
  formContainer: { maxWidth: 640, margin: "0 auto" },
  formHeader: { display: "flex", alignItems: "center", gap: 16, marginBottom: 24 },
  formTitle: { fontSize: 24, fontWeight: 700, margin: 0 },
  formGrid: { display: "flex", flexDirection: "column", gap: 20 },
  formField: { display: "flex", flexDirection: "column", gap: 6 },
  formRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  label: { fontSize: 13, fontWeight: 600, color: "#6B5744", textTransform: "uppercase", letterSpacing: "0.5px" },
  input: { padding: "10px 14px", border: "2px solid #E8DDD0", borderRadius: 10, fontSize: 15, background: "#FFFDF8", color: "#3D2E1F", outline: "none", fontFamily: "inherit" },
  select: { padding: "10px 14px", border: "2px solid #E8DDD0", borderRadius: 10, fontSize: 15, background: "#FFFDF8", color: "#3D2E1F", outline: "none", fontFamily: "inherit" },
  textarea: { padding: "10px 14px", border: "2px solid #E8DDD0", borderRadius: 10, fontSize: 15, background: "#FFFDF8", color: "#3D2E1F", outline: "none", fontFamily: "inherit", resize: "vertical" },
  listRow: { display: "flex", gap: 8, alignItems: "center", marginBottom: 6 },
  stepNum: { width: 28, height: 28, borderRadius: "50%", background: "#3D2E1F", color: "#FDF6EC", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 },
  removeBtn: { width: 32, height: 32, border: "none", borderRadius: 8, background: "#F5E0D0", color: "#C75B2A", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  addBtn: { background: "none", border: "2px dashed #D4C8BA", borderRadius: 10, padding: "10px", fontSize: 14, color: "#A08060", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 },
  saveBtn: { background: "#C75B2A", color: "#fff", border: "none", borderRadius: 12, padding: "14px 24px", fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(199,91,42,0.3)", marginTop: 8, fontFamily: "inherit" },
  emojiSection: { position: "relative", alignSelf: "flex-start" },
  emojiDisplay: { width: 72, height: 72, borderRadius: 16, background: "#F0E6D8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, cursor: "pointer", border: "2px solid #E8DDD0" },
  emojiGrid: { position: "absolute", top: 80, left: 0, background: "#FFFDF8", border: "2px solid #E8DDD0", borderRadius: 12, padding: 8, display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4, zIndex: 10, boxShadow: "0 8px 24px rgba(61,46,31,0.12)" },
  emojiOption: { fontSize: 24, padding: 6, cursor: "pointer", textAlign: "center", borderRadius: 8 },
  detailContainer: { maxWidth: 720, margin: "0 auto" },
  detailTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  detailActions: { display: "flex", gap: 8, alignItems: "center" },
  backBtn: { background: "none", border: "none", fontSize: 15, fontWeight: 600, color: "#C75B2A", cursor: "pointer", padding: 0, fontFamily: "inherit" },
  editBtn: { background: "#F0E6D8", border: "none", borderRadius: 10, padding: "8px 18px", fontSize: 14, fontWeight: 600, color: "#3D2E1F", cursor: "pointer", fontFamily: "inherit" },
  deleteBtn: { background: "none", border: "2px solid #E8DDD0", borderRadius: 10, padding: "8px 18px", fontSize: 14, fontWeight: 600, color: "#C75B2A", cursor: "pointer", fontFamily: "inherit" },
  confirmWrap: { display: "flex", alignItems: "center", gap: 6 },
  confirmText: { fontSize: 13, fontWeight: 600, color: "#C75B2A" },
  confirmYes: { background: "#C75B2A", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  confirmNo: { background: "#F0E6D8", color: "#3D2E1F", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  detailHero: { display: "flex", gap: 20, alignItems: "flex-start", marginBottom: 32 },
  detailEmoji: { fontSize: 56, width: 88, height: 88, borderRadius: 20, background: "#F0E6D8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  detailTitle: { fontSize: 28, fontWeight: 800, margin: "0 0 8px", lineHeight: 1.2 },
  detailMeta: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 8 },
  badge: { background: "#3D2E1F", color: "#FDF6EC", padding: "4px 14px", borderRadius: 12, fontSize: 12, fontWeight: 700 },
  metaItem: { fontSize: 14, color: "#A08060" },
  stars: { display: "flex", gap: 2 },
  star: { fontSize: 22 },
  detailBody: { display: "flex", flexDirection: "column", gap: 28 },
  detailSection: {},
  sectionTitle: { fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#A08060", marginBottom: 12, marginTop: 0, borderBottom: "2px solid #E8DDD0", paddingBottom: 8 },
  ingredientsList: { display: "flex", flexDirection: "column", gap: 6 },
  ingredientItem: { display: "flex", gap: 10, alignItems: "baseline", fontSize: 16, lineHeight: 1.6 },
  dot: { color: "#C75B2A", fontSize: 8, flexShrink: 0, marginTop: 4 },
  stepItem: { display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 16 },
  stepCircle: { width: 32, height: 32, borderRadius: "50%", background: "#C75B2A", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flexShrink: 0, marginTop: 2 },
  stepText: { margin: 0, fontSize: 16, lineHeight: 1.6, flex: 1 },
  notesBox: { background: "#F8F0E4", borderRadius: 14, padding: 20, border: "2px solid #E8DDD0" },
  notesText: { margin: 0, fontSize: 15, lineHeight: 1.7, color: "#6B5744", fontStyle: "italic" },
};
