const apiUrl = "http://localhost:3000";

// ADMIN PROTECTION
const currentUser = JSON.parse(localStorage.getItem("user"));
if (!currentUser || currentUser.role !== "admin") {
  alert("Access denied!");
  window.location.href = "auth.html";
}

const usersList = document.getElementById("usersList");
const searchUser = document.getElementById("searchUser");
const sortUsers = document.getElementById("sortUsers");

async function loadUsers() {
  const search = searchUser.value.trim();
  const sort = sortUsers.value;

  const url = new URL(`${apiUrl}/users/admin/list`);
  if (search) url.searchParams.set("search", search);
  if (sort) url.searchParams.set("sort", sort);

  try {
    const res = await fetch(url);
    const users = await res.json();
    usersList.innerHTML = users.map(u => `
      <div class="product-card">
        <h3>${u.name}</h3>
        <p>${u.email}</p>
        <p><strong>Orders:</strong> ${u.orderCount}</p>
        <p><strong>Status:</strong> ${u.is_blocked ? "❌ Blocked" : "✔ Active"}</p>

        <div style="width:100%; display:flex; gap:8px;">
          <a href="admin-user-details.html?id=${u.id}" class="page-btn" 
             style="flex:1; text-align:center; text-decoration:none;">
            View Details
          </a>

          <button class="page-btn"
                  onclick="toggleBlock(${u.id}, ${u.is_blocked})"
                  style="flex:1;">
            ${u.is_blocked ? "Unblock" : "Block"}
          </button>
        </div>
      </div>
    `).join("");

  } catch (err) {
    console.error(err);
    usersList.innerHTML = "<p>Error loading users</p>";
  }
}

async function toggleBlock(id, isBlocked) {
  const route = isBlocked ? "unblock" : "block";

  if (!confirm(`Are you sure you want to ${isBlocked ? "unblock" : "block"} this user?`)) return;

  try {
    await fetch(`${apiUrl}/users/admin/${route}/${id}`, { method: "PUT" });
    loadUsers();
  } catch (err) {
    alert("Error updating user status");
  }
}

// EVENTS
searchUser.addEventListener("input", loadUsers);
sortUsers.addEventListener("change", loadUsers);

loadUsers();