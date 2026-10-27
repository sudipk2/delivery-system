import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendEmailVerification
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp, getDocs, writeBatch
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { firebaseConfig, adminEmailAllowlist } from "./firebase-config.js";

// Firebase web config is not a password. Protect data with Firestore Security Rules.
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const dishesRef = collection(db, "dishes");

let foods = [];
let cart = {};
let activeCategory = "All";
let address = "Choose delivery location";
let map, destinationMarker, currentLocationMarker, accuracyCircle;
let unsubscribeDishes = null;
let adminUser = null;
const $ = (s) => document.querySelector(s);
const rupees = (n) => "₹" + Math.round(n);
const stages = ["Order confirmed", "Preparing your food", "Ready for pickup", "Out for delivery", "Delivered"];

function showToast(message) {
  const t = $("#toast"); t.textContent = message; t.classList.add("show");
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => t.classList.remove("show"), 3000);
}
function safeText(value) { return String(value ?? ""); }
function isAdmin(user) {
  return !!user && !!user.email && user.emailVerified &&
    adminEmailAllowlist.map(e => e.toLowerCase()).includes(user.email.toLowerCase());
}
function renderFoods() {
  const queryText = $("#searchInput").value.trim().toLowerCase();
  const list = foods.filter(f =>
    (activeCategory === "All" || f.category === activeCategory) &&
    (!queryText || `${f.name} ${f.description} ${f.category}`.toLowerCase().includes(queryText))
  );
  $("#menuMessage").textContent = foods.length
    ? `${foods.filter(f => f.available).length} dishes currently available · Menu updates automatically`
    : "No dishes have been added yet. Please check back soon.";
  $("#foodGrid").innerHTML = list.map(f => `
    <article class="food-card">
      <div class="food-image">
        <img src="${safeText(f.image)}" alt="${safeText(f.name)}" loading="lazy"
          onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=700&q=80'">
        <span class="availability ${f.available ? "available" : "sold"}">${f.available ? "● Available" : "● Sold out"}</span>
      </div>
      <div class="food-content"><h3>${safeText(f.name)}</h3>
        <div class="food-desc">${safeText(f.description)}</div>
        <div class="food-meta"><span class="food-price">${rupees(f.price)}</span><span class="food-rating">${safeText(f.category)}</span></div>
        <button class="add-button" data-add="${safeText(f.id)}" ${!f.available ? "disabled" : ""}>
          ${f.available ? "+ Add to cart" : "Currently unavailable"}
        </button>
      </div>
    </article>`).join("") || '<p>No dishes match your search.</p>';

  document.querySelectorAll("[data-add]").forEach(btn => btn.addEventListener("click", () => {
    const id = btn.dataset.add;
    const food = foods.find(f => f.id === id);
    if (!food || !food.available) return showToast("This dish is currently unavailable.");
    cart[id] = (cart[id] || 0) + 1;
    renderCart(); showToast("Added to your cart.");
  }));
}
function totals() {
  const subtotal = foods.reduce((sum, f) => sum + f.price * (cart[f.id] || 0), 0);
  const delivery = subtotal ? 20 : 0;
  const tax = subtotal ? Math.round(subtotal * 0.05) : 0;
  return { subtotal, delivery, tax, total: subtotal + delivery + tax };
}
function renderCart() {
  // Remove items that are no longer in the live menu or became unavailable.
  for (const id of Object.keys(cart)) {
    const f = foods.find(item => item.id === id);
    if (!f || !f.available) delete cart[id];
  }
  const entries = foods.filter(f => cart[f.id]);
  $("#cartCount").textContent = entries.reduce((sum, f) => sum + cart[f.id], 0);
  $("#cartItems").innerHTML = entries.length ? entries.map(f => `
    <div class="cart-row"><div><strong>${safeText(f.name)}</strong>
      <small>${rupees(f.price)} each · ${rupees(f.price * cart[f.id])}</small></div>
      <div class="quantity"><button data-minus="${f.id}">−</button><strong>${cart[f.id]}</strong><button data-plus="${f.id}">+</button></div>
    </div>`).join("") : '<div class="empty-cart">Your cart is empty. Add an available dish to get started.</div>';
  document.querySelectorAll("[data-minus]").forEach(b => b.onclick = () => {
    const id = b.dataset.minus; cart[id]--; if (cart[id] <= 0) delete cart[id]; renderCart();
  });
  document.querySelectorAll("[data-plus]").forEach(b => b.onclick = () => {
    const id = b.dataset.plus; cart[id]++; renderCart();
  });
  const t = totals();
  $("#subtotal").textContent = rupees(t.subtotal); $("#deliveryFee").textContent = rupees(t.delivery);
  $("#taxes").textContent = rupees(t.tax); $("#total").textContent = rupees(t.total);
}
function openCart() { $("#overlay").classList.add("open"); $("#cartDrawer").classList.add("open"); }
function closeCart() { $("#overlay").classList.remove("open"); $("#cartDrawer").classList.remove("open"); }

document.querySelectorAll(".chip").forEach(b => b.addEventListener("click", () => {
  document.querySelectorAll(".chip").forEach(x => x.classList.remove("active"));
  b.classList.add("active"); activeCategory = b.dataset.category; renderFoods();
}));
$("#searchButton").onclick = renderFoods;
$("#searchInput").addEventListener("keydown", e => { if (e.key === "Enter") renderFoods(); });
$("#cartButton").onclick = openCart; $("#closeCart").onclick = closeCart; $("#overlay").onclick = closeCart;
$("#showOrders").onclick = () => $("#tracking").scrollIntoView({ behavior: "smooth" });

$("#checkoutButton").onclick = () => {
  if (!Object.keys(cart).length) {
    return showToast("Add an available dish before continuing.");
  }

  // Require login before checkout
  if (!auth.currentUser) {
    $("#authModal")?.classList.add("open");
    return showToast("Please log in before placing an order.");
  }

  // Show payment choices
  $("#checkoutTotal").textContent = rupees(totals().total);
  closeCart();
  $("#paymentModal")?.classList.add("is-open");
};


$("#changeAddress").onclick = () => { $("#addressInput").value = address; $("#addressModal").classList.add("open"); };
$("#closeAddress").onclick = () => $("#addressModal").classList.remove("open");
$("#saveAddress").onclick = () => {
  const val = $("#addressInput").value.trim();
  if (!val) return showToast("Enter a delivery location first.");
  address = val; $("#addressLabel").textContent = address; $("#mapAddress").textContent = address;
  $("#addressModal").classList.remove("open"); showToast("Delivery location updated.");
};

// Admin UI: Firebase Authentication plus email allowlist; Firestore rules enforce permissions too.
$("#adminButton").onclick = () => { $("#adminModal").classList.add("open"); };
$("#closeAdmin").onclick = () => $("#adminModal").classList.remove("open");
$("#adminLogin").onclick = async () => {
  $("#adminLogin").disabled = true;
  try {
    const email = $("#adminEmail").value.trim();
    const password = $("#adminPassword").value;
    const credential = await signInWithEmailAndPassword(auth, email, password);
    if (adminEmailAllowlist.map(e => e.toLowerCase()).includes((credential.user.email || "").toLowerCase())
        && !credential.user.emailVerified) {
      await sendEmailVerification(credential.user);
      await signOut(auth);
      throw new Error("A verification email was sent. Open the link in your inbox, then return here and sign in again.");
    }
    if (!isAdmin(credential.user)) {
      await signOut(auth);
      throw new Error("This account is not an authorized admin. Check firebase-config.js and the published Firestore rules.");
    }
    showToast("Admin signed in.");
  } catch (error) {
    $("#adminError")?.remove();
    const p = document.createElement("p"); p.id = "adminError"; p.className = "admin-error";
    p.textContent = error.code ? `${error.code}: ${error.message}` : error.message;
    $("#adminSignedOut").append(p);
  } finally { $("#adminLogin").disabled = false; }
};
$("#adminLogout").onclick = async () => { await signOut(auth); showToast("Signed out."); };
onAuthStateChanged(auth, user => {
  adminUser = isAdmin(user) ? user : null;
  $("#adminSignedOut").hidden = !!adminUser;
  $("#adminSignedIn").hidden = !adminUser;
  if (adminUser) $("#adminIdentity").textContent = `Signed in as ${adminUser.email}`;
  renderAdminList();
});
function requireAdmin() {
  if (!isAdmin(auth.currentUser)) throw new Error("Admin permission required. Sign in with the authorized verified admin account.");
}
function resetDishForm() {
  $("#dishForm").reset(); $("#dishId").value = ""; $("#dishAvailable").checked = true;
  $("#saveDishButton").textContent = "Add dish"; $("#cancelEdit").hidden = true;
}
$("#cancelEdit").onclick = resetDishForm;
$("#importStarterMenu").onclick = async () => {
  try {
    requireAdmin();
    const confirmed = confirm("Import 16 sample dishes only if the Firestore menu is empty? These are example menu entries and prices. Review them before serving customers.");
    if (!confirmed) return;
    await seedMenuIfEmpty();
  } catch (error) {
    showToast(error.message || "Could not import starter menu.");
  }
};

$("#dishForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    requireAdmin();
    const id = $("#dishId").value;
    const name = $("#dishName").value.trim();
    const description = $("#dishDescription").value.trim();
    const price = Number($("#dishPrice").value);
    const category = $("#dishCategory").value;
    const image = $("#dishImage").value.trim();
    const available = $("#dishAvailable").checked;
    if (!name || !description || !Number.isFinite(price) || price <= 0 || !image) throw new Error("Fill all required fields with a valid positive price and image URL.");
    const payload = { name, description, price, category, image, available, updatedAt: serverTimestamp() };
    if (id) await updateDoc(doc(db, "dishes", id), payload);
    else await addDoc(dishesRef, { ...payload, createdAt: serverTimestamp() });
    resetDishForm(); showToast(id ? "Dish updated." : "Dish added.");
  } catch (error) { showToast(error.message || "Unable to save dish."); }
});
function renderAdminList() {
  const list = $("#adminDishList");
  if (!adminUser) { list.innerHTML = ""; return; }
  list.innerHTML = foods.map(f => `<div class="admin-dish">
    <img src="${safeText(f.image)}" alt="" onerror="this.style.visibility='hidden'">
    <div><strong>${safeText(f.name)}</strong><small>${rupees(f.price)} · ${safeText(f.category)} · ${f.available ? "Available" : "Sold out"}</small></div>
    <div class="admin-dish-actions">
      <button class="small-button" data-edit="${f.id}">Edit</button>
      <button class="small-button" data-toggle="${f.id}">${f.available ? "Mark sold out" : "Mark available"}</button>
      <button class="small-button danger" data-delete="${f.id}">Delete</button>
    </div></div>`).join("") || '<p class="tiny-note">No dishes in the database yet. Use the form above to add your first dish.</p>';
  list.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => {
    const f = foods.find(x => x.id === b.dataset.edit); if (!f) return;
    $("#dishId").value = f.id; $("#dishName").value = f.name; $("#dishDescription").value = f.description;
    $("#dishPrice").value = f.price; $("#dishCategory").value = f.category; $("#dishImage").value = f.image;
    $("#dishAvailable").checked = f.available; $("#saveDishButton").textContent = "Save changes";
    $("#cancelEdit").hidden = false; $("#dishName").focus();
  });
  list.querySelectorAll("[data-toggle]").forEach(b => b.onclick = async () => {
    try { requireAdmin(); const f = foods.find(x => x.id === b.dataset.toggle); if (!f) return;
      await updateDoc(doc(db, "dishes", f.id), { available: !f.available, updatedAt: serverTimestamp() });
      showToast("Availability updated.");
    } catch (e) { showToast(e.message); }
  });
  list.querySelectorAll("[data-delete]").forEach(b => b.onclick = async () => {
    const f = foods.find(x => x.id === b.dataset.delete); if (!f) return;
    if (!confirm(`Delete "${f.name}" from the menu? This cannot be undone.`)) return;
    try { requireAdmin(); await deleteDoc(doc(db, "dishes", f.id)); showToast("Dish deleted."); }
    catch (e) { showToast(e.message); }
  });
}

const initialMenu = [{"name":"Rainbow Veg Bowl","category":"Healthy","price":145,"description":"Fresh vegetables, grains and a zesty dressing.","rating":"4.8","available":true,"image":"https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=700&q=80"},{"name":"Paneer Rice Bowl","category":"Meals","price":160,"description":"Comforting rice with spiced paneer.","rating":"4.7","available":true,"image":"https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=700&q=80"},{"name":"Masala Dosa","category":"Meals","price":90,"description":"Crispy dosa served with chutney and sambar.","rating":"4.6","available":true,"image":"https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=700&q=80"},{"name":"Veg Burger","category":"Snacks","price":110,"description":"Toasted bun with a crunchy vegetable patty.","rating":"4.5","available":true,"image":"https://images.unsplash.com/photo-1520072959219-c595dc870360?auto=format&fit=crop&w=700&q=80"},{"name":"Fruit and Yogurt Bowl","category":"Healthy","price":125,"description":"Seasonal fruit with creamy yogurt.","rating":"4.8","available":true,"image":"https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38?auto=format&fit=crop&w=700&q=80"},{"name":"Paneer Wrap","category":"Snacks","price":80,"description":"Paneer and salad wrapped for an easy bite.","rating":"4.4","available":false,"image":"https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=700&q=80"},{"name":"Veg Noodle Bowl","category":"Meals","price":135,"description":"Wok-tossed noodles with fresh vegetables.","rating":"4.5","available":true,"image":"https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=700&q=80"},{"name":"Avocado Toast","category":"Healthy","price":150,"description":"Toasted bread with greens and avocado.","rating":"4.6","available":true,"image":"https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=700&q=80"},{"name":"Margherita Pizza","category":"Meals","price":179,"description":"Classic cheese pizza with tomato and basil.","rating":"4.7","available":true,"image":"https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=700&q=80"},{"name":"French Fries","category":"Snacks","price":79,"description":"Golden crisp fries with a light seasoning.","rating":"4.4","available":true,"image":"https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=700&q=80"},{"name":"Veg Momos","category":"Snacks","price":99,"description":"Steamed vegetable dumplings with dipping sauce.","rating":"4.6","available":true,"image":"https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=700&q=80"},{"name":"Grilled Sandwich","category":"Snacks","price":95,"description":"Grilled sandwich with vegetables and cheese.","rating":"4.3","available":true,"image":"https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=700&q=80"},{"name":"Chickpea Salad","category":"Healthy","price":119,"description":"Chickpeas, fresh vegetables and herbs.","rating":"4.5","available":true,"image":"https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=700&q=80"},{"name":"Mango Smoothie","category":"Drinks","price":89,"description":"A chilled mango smoothie.","rating":"4.5","available":true,"image":"https://images.unsplash.com/photo-1505252585461-04db1eb84625?auto=format&fit=crop&w=700&q=80"},{"name":"Cold Coffee","category":"Drinks","price":99,"description":"Chilled coffee with milk.","rating":"4.4","available":true,"image":"https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=700&q=80"},{"name":"Chocolate Brownie","category":"Snacks","price":75,"description":"Rich chocolate brownie.","rating":"4.6","available":true,"image":"https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=700&q=80"}];

// Live Firestore listener: customer menu refreshes across devices when admin edits dishes.
async function seedMenuIfEmpty() {
  // Called only after the verified allowlisted admin signs in.
  requireAdmin();
  const existing = await getDocs(dishesRef);
  if (!existing.empty) {
    showToast("Menu already has dishes; sample menu was not imported.");
    return;
  }
  const batch = writeBatch(db);
  initialMenu.forEach(item => {
    const newRef = doc(dishesRef);
    const { rating, ...storedItem } = item;
    batch.set(newRef, { ...storedItem, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
  await batch.commit();
  showToast("Starter menu imported. Review availability and prices before launch.");
}
function startMenuListener() {
  if (unsubscribeDishes) unsubscribeDishes();
  const q = query(dishesRef, orderBy("name"));
  unsubscribeDishes = onSnapshot(q, snapshot => {
    foods = snapshot.docs.map(d => {
      const data = d.data();
      return { id: d.id, name: data.name || "", description: data.description || "",
        price: Number(data.price) || 0, category: data.category || "Meals",
        image: data.image || "", available: data.available === true };
    });
    renderFoods(); renderCart(); renderAdminList();
  }, error => {
    $("#menuMessage").textContent = "Unable to load menu. Check Firebase setup and Firestore rules.";
    console.error("Firestore menu listener:", error);
    showToast("Could not load menu. Check Firebase configuration.");
  });
}
startMenuListener();

// Map remains independent from menu management.
function initMap() {
  if (!window.L) { $("#map").textContent = "Map failed to load. Check your internet connection."; return; }
  const initial = [12.7449, 77.8253];
  map = L.map("map").setView(initial, 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
  destinationMarker = L.marker(initial, { draggable: true }).addTo(map).bindPopup("Delivery destination");
  destinationMarker.on("dragend", () => reverseGeocode(destinationMarker.getLatLng().lat, destinationMarker.getLatLng().lng));
  map.on("click", e => { destinationMarker.setLatLng(e.latlng); reverseGeocode(e.latlng.lat, e.latlng.lng); });
  setTimeout(() => map.invalidateSize(), 250);
}
async function reverseGeocode(lat, lng) {
  const coords = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  address = coords; $("#mapAddress").textContent = coords; $("#addressLabel").textContent = "Selected map location";
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
    if (!response.ok) throw new Error("Reverse geocoding unavailable");
    const data = await response.json(); const a = data.address || {};
    const readable = data.name || [a.road, a.suburb || a.neighbourhood, a.city || a.town || a.village, a.state].filter(Boolean).join(", ");
    if (readable) { address = readable; $("#mapAddress").textContent = readable; $("#addressLabel").textContent = readable; }
    destinationMarker.bindPopup(`Delivery destination<br>${readable || coords}`).openPopup();
  } catch (error) { console.warn(error); }
}
$("#locateMe").onclick = () => {
  if (!navigator.geolocation) return showToast("This browser does not support location detection.");
  showToast("Requesting device location permission…");
  navigator.geolocation.getCurrentPosition(async pos => {
    const lat = pos.coords.latitude, lng = pos.coords.longitude, point = [lat, lng];
    map.setView(point, 17); destinationMarker.setLatLng(point);
    if (currentLocationMarker) map.removeLayer(currentLocationMarker);
    if (accuracyCircle) map.removeLayer(accuracyCircle);
    currentLocationMarker = L.circleMarker(point, { radius: 8, color: "#176b48", fillColor: "#42b875", fillOpacity: 1, weight: 3 })
      .addTo(map).bindPopup("Detected device location");
    accuracyCircle = L.circle(point, { radius: pos.coords.accuracy, color: "#176b48", fillColor: "#42b875", fillOpacity: .1, weight: 1 }).addTo(map);
    await reverseGeocode(lat, lng);
    showToast(`Location detected; reported accuracy about ${Math.round(pos.coords.accuracy)} metres.`);
  }, error => {
    const messages = { 1: "Location permission denied.", 2: "Location unavailable.", 3: "Location request timed out." };
    showToast(messages[error.code] || "Unable to detect location.");
  }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
};
initMap();
renderCart();

// ===================================
// SMARTBITE PAYMENT MODAL CONTROLS
// ===================================

const paymentModal = document.getElementById("paymentModal");
const closePayment = document.getElementById("closePayment");
const cancelPayment = document.getElementById("cancelPayment");
const continuePayment = document.getElementById("continuePayment");
const paymentMessage = document.getElementById("paymentMessage");
const checkoutTotal = document.getElementById("checkoutTotal");

function openPaymentModal(total = 0) {
  if (!paymentModal) return;

  // Require customer login before opening checkout.
  if (!auth.currentUser) {
    const authModal = document.getElementById("authModal");

    if (authModal) {
      authModal.classList.add("active");
      authModal.style.display = "flex";
    } else {
      alert("Please log in before placing an order.");
    }

    return;
  }

  checkoutTotal.textContent = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR"
  }).format(total);

  paymentModal.classList.add("is-open");
}

function closePaymentModal() {
  paymentModal?.classList.remove("is-open");
}

closePayment?.addEventListener("click", closePaymentModal);
cancelPayment?.addEventListener("click", closePaymentModal);

paymentModal?.addEventListener("click", (event) => {
  if (event.target === paymentModal) {
    closePaymentModal();
  }
});

// Highlight the selected payment option.
document.querySelectorAll('input[name="paymentMethod"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    document.querySelectorAll(".payment-option").forEach((option) => {
      option.classList.toggle(
        "selected",
        option.querySelector('input[name="paymentMethod"]').checked
      );
    });

    paymentMessage.textContent =
      radio.value === "cod"
        ? "Cash on Delivery is selected."
        : "Online payment requires a configured payment gateway.";
  });
});

// UI only: no order or payment is created here.
continuePayment?.addEventListener("click", () => {
  const selectedMethod = document.querySelector(
    'input[name="paymentMethod"]:checked'
  )?.value;

  if (selectedMethod === "cod") {
    paymentMessage.textContent =
      "COD selected. Connect order submission before confirming.";
  } else {
    paymentMessage.textContent =
      "Online payment is not connected yet.";
  }
});