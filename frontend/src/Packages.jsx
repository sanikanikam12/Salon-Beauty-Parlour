
import { useEffect, useState } from "react";
import "./Packages.css";

const API = "http://127.0.0.1:8000/api/salon/packages/";
const SERVICES_API = "http://127.0.0.1:8000/api/salon/services/";
const PURCHASES_API = "http://127.0.0.1:8000/api/salon/customer-packages/";

const emptyForm = {
  name: "",
  description: "",
  price: "",
  validity_days: "30",
  included_visits: "1",
  service_ids: [],
};

function getLoggedInUser() {
  try {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  } catch {
    return null;
  }
}

function Packages() {
  const [user] = useState(getLoggedInUser);

  const role = String(user?.role || "").toLowerCase();
  const email = String(user?.email || "").trim().toLowerCase();

  const isCustomer = role === "customer";
  const isAdmin = role === "admin" || role === "receptionist";

  const [packages, setPackages] = useState([]);
  const [services, setServices] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState("packages");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function readResponse(response) {
    const text = await response.text();
    let result = {};

    try {
      result = text ? JSON.parse(text) : {};
    } catch {
      result = {
        error: text || "Server kadun valid response milala nahi.",
      };
    }

    if (!response.ok) {
      throw new Error(
        result.error || result.detail || "Request complete zali nahi."
      );
    }

    return result;
  }

  async function loadPackagesAndServices() {
    const [packageResponse, serviceResponse] = await Promise.all([
      fetch(API),
      fetch(SERVICES_API),
    ]);

    const packageData = await readResponse(packageResponse);
    const serviceData = await readResponse(serviceResponse);

    setPackages(Array.isArray(packageData) ? packageData : []);
    setServices(Array.isArray(serviceData) ? serviceData : []);
  }

  async function loadPurchases() {
    if (!user?.email || !user?.role) {
      setError("Login details milat nahit. Logout karun punha login kara.");
      return;
    }

    const params = new URLSearchParams({
      email: user.email,
      role: user.role,
    });

    const response = await fetch(
      `${PURCHASES_API}?${params.toString()}`
    );

    const data = await readResponse(response);
    setPurchases(Array.isArray(data) ? data : []);
  }

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      await loadPackagesAndServices();

      if (user?.email && user?.role) {
        await loadPurchases();
      }
    } catch (err) {
      setError(err.message || "Backend suru aahe ka te tapasa.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function handleServiceChange(serviceId) {
    setForm((previous) => ({
      ...previous,
      service_ids: previous.service_ids.includes(serviceId)
        ? previous.service_ids.filter((id) => id !== serviceId)
        : [...previous.service_ids, serviceId],
    }));
  }

  function openAddForm() {
    setForm(emptyForm);
    setEditingId(null);
    setMessage("");
    setError("");
    setShowForm(true);
  }

  function openEditForm(item) {
    setForm({
      name: item.name,
      description: item.description || "",
      price: item.price,
      validity_days: String(item.validity_days),
      included_visits: String(item.included_visits ?? 1),
      service_ids: (item.services || []).map((service) => service.id),
    });

    setEditingId(item.id);
    setMessage("");
    setError("");
    setShowForm(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    const editing = editingId !== null;
    const url = editing ? `${API}${editingId}/edit/` : API;

    try {
      const response = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          price: Number(form.price),
          validity_days: Number(form.validity_days),
          included_visits: Number(form.included_visits),
          service_ids: form.service_ids,
        }),
      });

      await readResponse(response);

      setMessage(
        editing
          ? "Package successfully update zala!"
          : "Package successfully add zala!"
      );

      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);

      await loadPackagesAndServices();
    } catch (err) {
      setError(err.message || "Package save zala nahi.");
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Ha package delete karaycha aahe ka?")) {
      return;
    }

    setMessage("");
    setError("");

    try {
      const response = await fetch(`${API}${id}/delete/`, {
        method: "DELETE",
      });

      await readResponse(response);

      setMessage("Package delete zala!");
      await loadPackagesAndServices();
    } catch (err) {
      setError(err.message || "Package delete zala nahi.");
    }
  }

 async function buyPackage(item) {
  if (!user || !email || role !== "customer") {
    window.location.href = "/";
    return;
  }

    if (
      !window.confirm(
        `"${item.name}" package purchase request pathvaychi ka?`
      )
    ) {
      return;
    }

    setMessage("");
    setError("");

    try {
      const response = await fetch(PURCHASES_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Role": role,
          "X-User-Email": email,
        },
        body: JSON.stringify({
          package_id: item.id,
          email,
          role,
        }),
      });

      await readResponse(response);

      setMessage(
        "Purchase request pathavli! Admin confirmation nantar status update hoil."
      );

      await loadPurchases();
      setView("my-packages");
    } catch (err) {
      setError(err.message || "Purchase request pathavta aali nahi.");
    }
  }

  // FIX: Admin/Receptionist role and email are sent to Django.
  async function updatePurchase(purchaseId, changes) {
    setMessage("");
    setError("");

    let currentUser;

    try {
      currentUser = JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      currentUser = null;
    }

    const currentRole = String(currentUser?.role || "").toLowerCase();
    const currentEmail = String(currentUser?.email || "").trim().toLowerCase();

    if (currentRole !== "admin" && currentRole !== "receptionist") {
      setError(
        "Package status update karnyasathi Admin kiwa Receptionist account ne login kara."
      );
      return;
    }

    if (!currentEmail) {
      setError("Login email milat nahi. Logout karun punha login kara.");
      return;
    }

    try {
      const response = await fetch(`${PURCHASES_API}${purchaseId}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-User-Role": currentRole,
          "X-User-Email": currentEmail,
        },
        body: JSON.stringify({
          ...changes,
          role: currentRole,
          email: currentEmail,
        }),
      });

      await readResponse(response);

      setMessage("Purchase status successfully update zala!");

      await loadPurchases();
    } catch (err) {
      setError(err.message || "Status update zala nahi.");
    }
  }

  const activePackages = packages.filter((item) => item.is_active);

  function formatPrice(price) {
    return Number(price || 0).toLocaleString("en-IN");
  }

  function statusLabel(status) {
    const labels = {
      pending: "Pending",
      confirmed: "Confirmed",
      cancelled: "Cancelled",
      expired: "Expired",
      paid: "Paid",
    };

    return labels[String(status || "").toLowerCase()] || status || "Unknown";
  }

  if (!user) {
    return (
      <div className="packages-page">
        <div className="package-error">
          Login details milat nahit. Logout karun punha login kara.
        </div>
      </div>
    );
  }

  return (
    <div className="packages-page">
      <div className="packages-heading">
        <div>
          <h1>Beauty Packages</h1>
          <p>
            {isCustomer
              ? "Tuzya sathi yogya beauty package nivad."
              : "Manage your salon beauty packages"}
          </p>
        </div>

        {isAdmin && view === "packages" && (
          <button className="package-primary-btn" onClick={openAddForm}>
            + Add Package
          </button>
        )}
      </div>

      {(isCustomer || isAdmin) && (
        <div className="package-tabs">
          <button
            className={
              view === "packages" ? "package-tab active" : "package-tab"
            }
            onClick={() => {
              setView("packages");
              setShowForm(false);
              setError("");
              setMessage("");
            }}
          >
            {isAdmin ? "Manage Packages" : "Available Packages"}
          </button>

          <button
            className={
              view === "my-packages" ? "package-tab active" : "package-tab"
            }
            onClick={async () => {
              setView("my-packages");
              setShowForm(false);
              setError("");
              setMessage("");
              await loadPurchases();
            }}
          >
            {isAdmin ? "Purchase Requests" : "My Packages"}
          </button>
        </div>
      )}

      {message && <div className="package-success">{message}</div>}
      {error && <div className="package-error">{error}</div>}
      {loading && <p className="package-loading">Loading...</p>}

      {view === "packages" && isAdmin && showForm && (
        <form className="package-form" onSubmit={handleSubmit}>
          <h2>{editingId ? "Edit Package" : "Add New Package"}</h2>

          <label>Package Name *</label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="e.g. Bridal Glow Package"
            required
          />

          <label>Description</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="Describe this beauty package"
            rows="3"
          />

          <div className="package-form-row">
            <div>
              <label>Price (₹) *</label>
              <input
                type="number"
                name="price"
                value={form.price}
                onChange={handleChange}
                min="0"
                step="0.01"
                required
              />
            </div>

            <div>
              <label>Validity (days) *</label>
              <input
                type="number"
                name="validity_days"
                value={form.validity_days}
                onChange={handleChange}
                min="1"
                required
              />
            </div>
          </div>

          <label>Included Visits *</label>
          <input
            type="number"
            name="included_visits"
            value={form.included_visits}
            onChange={handleChange}
            min="1"
            step="1"
            required
          />

          <label>Included Services</label>

          <div className="package-service-options">
            {services.map((service) => (
              <label key={service.id} className="package-service-option">
                <input
                  type="checkbox"
                  checked={form.service_ids.includes(service.id)}
                  onChange={() => handleServiceChange(service.id)}
                />
                <span>
                  {service.name} — ₹{service.price}
                </span>
              </label>
            ))}
          </div>

          <div className="package-form-actions">
            <button type="submit" className="package-primary-btn">
              {editingId ? "Update Package" : "Save Package"}
            </button>

            <button
              type="button"
              className="package-cancel-btn"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {view === "packages" && (
        <div className="packages-grid">
          {activePackages.map((item) => (
            <div className="package-card" key={item.id}>
              <div className="package-card-top">
                <div className="package-icon">♡</div>
                <span className="package-active">Active</span>
              </div>

              <h2>{item.name}</h2>

              <p className="package-description">
                {item.description || "Beauty package from Glow Beauty Salon"}
              </p>

              <div className="package-price">₹{formatPrice(item.price)}</div>

              <p className="package-validity">
                Valid for {item.validity_days} days
              </p>

              <p className="package-validity">
                Includes {item.included_visits ?? 1} visit(s)
              </p>

              <div className="package-included">
                <strong>Included Services</strong>

                {item.services?.length ? (
                  item.services.map((service) => (
                    <div className="package-service" key={service.id}>
                      <span>✓</span> {service.name}
                    </div>
                  ))
                ) : (
                  <p>No services selected</p>
                )}
              </div>

              {isAdmin && (
                <div className="package-card-actions">
                  <button onClick={() => openEditForm(item)}>Edit</button>
                  <button
                    className="package-delete-btn"
                    onClick={() => handleDelete(item.id)}
                  >
                    Delete
                  </button>
                </div>
              )}

              {isCustomer && (
                <div className="package-card-actions">
                  <button
                    className="package-buy-btn"
                    onClick={() => buyPackage(item)}
                  >
                    Buy Package
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {view === "packages" && activePackages.length === 0 && !error && (
        <div className="packages-empty">
          <h2>No packages available</h2>
          <p>
            {isAdmin
              ? "Click Add Package to create your first beauty package."
              : "Sadhya active packages available nahit."}
          </p>
        </div>
      )}

      {view === "my-packages" && (
        <div className="package-purchases">
          <h2>{isAdmin ? "Customer Purchase Requests" : "My Packages"}</h2>

          {purchases.length === 0 ? (
            <div className="packages-empty">
              <h3>
                {isAdmin
                  ? "No purchase requests yet"
                  : "Ajun packages purchase kele nahit"}
              </h3>
              <p>
                {isAdmin
                  ? "Customer package request pathavtil tevha ithe disel."
                  : "Available Packages madhun package nivad."}
              </p>
            </div>
          ) : (
            <div className="package-purchase-list">
              {purchases.map((purchase) => (
                <div className="package-purchase-card" key={purchase.id}>
                  <div className="package-purchase-info">
                    <h3>
                      {purchase.package_name ||
                        purchase.package?.name ||
                        "Beauty Package"}
                    </h3>

                    {isAdmin && (
                      <p>
                        Customer:{" "}
                        {purchase.customer_name ||
                          purchase.customer?.full_name ||
                          purchase.customer_email ||
                          "Customer"}
                      </p>
                    )}

                    <p>
                      Price: ₹
                      {formatPrice(
                        purchase.price ||
                          purchase.package_price ||
                          purchase.package?.price
                      )}
                    </p>

                    <p>
                      Purchase date:{" "}
                      {purchase.purchase_date
                        ? new Date(purchase.purchase_date).toLocaleDateString(
                            "en-IN"
                          )
                        : "—"}
                    </p>

                    <p>Expiry date: {purchase.expiry_date || "Not set"}</p>
                    <p>Included visits: {purchase.included_visits ?? 1}</p>
                    <p>Remaining visits: {purchase.remaining_visits ?? 0}</p>
                    {purchase.services?.length > 0 && (
                      <p>
                        Included services:{" "}
                        {purchase.services
                          .map((service) => service.name)
                          .join(", ")}
                      </p>
                    )}
                  </div>

                  <div className="package-purchase-status">
                    <span
                      className={`package-status status-${
                        purchase.status || "pending"
                      }`}
                    >
                      {statusLabel(purchase.status)}
                    </span>

                    <span
                      className={`package-status status-${
                        purchase.payment_status || "pending"
                      }`}
                    >
                      Payment: {statusLabel(purchase.payment_status)}
                    </span>

                    {purchase.expiry_status && (
                      <span
                        className={`package-status status-${String(
                          purchase.expiry_status
                        ).toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        {purchase.expiry_status}
                      </span>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="package-purchase-actions">
                      <button
                        onClick={() =>
                          updatePurchase(purchase.id, {
                            status: "confirmed",
                          })
                        }
                      >
                        Confirm
                      </button>

                      <button
                        onClick={() =>
                          updatePurchase(purchase.id, {
                            status: "cancelled",
                          })
                        }
                      >
                        Cancel
                      </button>

                      <button
                        onClick={() =>
                          updatePurchase(purchase.id, {
                            payment_status: "paid",
                          })
                        }
                      >
                        Mark Paid
                      </button>

                      <button
                        onClick={() =>
                          updatePurchase(purchase.id, {
                            payment_status: "pending",
                          })
                        }
                      >
                        Mark Unpaid
                      </button>

                      {purchase.status === "confirmed" &&
                        purchase.payment_status === "paid" &&
                        Number(purchase.remaining_visits || 0) > 0 && (
                          <button
                            onClick={() =>
                              updatePurchase(purchase.id, {
                                consume_visit: true,
                              })
                            }
                          >
                            Use One Visit
                          </button>
                        )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Packages;


// MEMBERSHIP VISITS UI INSTALLED
