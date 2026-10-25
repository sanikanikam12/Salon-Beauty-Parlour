
import { useEffect, useState } from "react";
import "./App.css";
import Staff from "./Staff";
import Packages from "./Packages";
import Billing from "./Billing";
import Reports from "./Reports";
import Notifications from "./Notifications";
import StaffScheduling from "./StaffScheduling";

const API = `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}`;

function App() {
  const [page, setPage] = useState("login");
  const [loginRole, setLoginRole] = useState("customer");
  const [activeSection, setActiveSection] = useState("Dashboard");
  const [showPassword, setShowPassword] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [message, setMessage] = useState("");

  const [loggedInUser, setLoggedInUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || null;
    } catch {
      return null;
    }
  });

  // CUSTOMERS
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerHistory, setCustomerHistory] = useState(null);
  const [customerHistoryLoading, setCustomerHistoryLoading] = useState(false);
  const [customerHistoryError, setCustomerHistoryError] = useState("");

  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerError, setCustomerError] = useState("");
  const [customerSuccess, setCustomerSuccess] = useState("");
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [customerForm, setCustomerForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
    preferences: "",
  });

  // SERVICES
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [servicesError, setServicesError] = useState("");
  const [serviceSuccess, setServiceSuccess] = useState("");
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [serviceForm, setServiceForm] = useState({
    name: "",
    description: "",
    price: "",
    duration_minutes: 30,
    image_url: "",
  });
  const [staffList, setStaffList] = useState([]);

  // APPOINTMENTS
  const [appointments, setAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [appointmentError, setAppointmentError] = useState("");
  const [appointmentSuccess, setAppointmentSuccess] = useState("");
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState(null);

  const [appointmentForm, setAppointmentForm] = useState({
    customer_id: "",
     staff_id: "",
    service_id: "",
    appointment_date: "",
    appointment_time: "",
    notes: "",
  });

  const adminDashboardItems = [
    { icon: "🏠", title: "Dashboard", description: "Salon overview" },
    { icon: "👥", title: "Customers", description: "Manage customers" },
    { icon: "✂️", title: "Services", description: "Salon services" },
    { icon: "🎁", title: "Packages", description: "Beauty packages" },
    { icon: "📅", title: "Appointments", description: "Manage bookings" },
    { icon: "💇", title: "Staff", description: "Manage salon staff" },
    { icon: "???", title: "Staff Scheduling", description: "Working hours and daily schedule" },
    { icon: "💳", title: "Billing & Payments", description: "Payment records" },
    { icon: "📊", title: "Reports", description: "View salon reports" },
    { icon: "??", title: "Notifications", description: "Appointment and payment alerts" },
  ];

  const customerDashboardItems = [
    { icon: "🏠", title: "Dashboard", description: "Welcome to your salon space" },
    { icon: "✂️", title: "Services", description: "Explore beauty services" },
    { icon: "🎁", title: "Packages", description: "Explore beauty packages" },
    { icon: "📅", title: "Appointments", description: "Book and view your appointments" },
    { icon: "👤", title: "My Profile", description: "View your account details" },
  ];

 
const receptionistDashboardItems = [
  { icon: "🏠", title: "Dashboard", description: "Salon overview" },
  { icon: "👥", title: "Customers", description: "Manage customer details" },
  { icon: "✂️", title: "Services", description: "View salon services" },
  { icon: "📅", title: "Appointments", description: "Manage customer bookings" },
];

const stylistDashboardItems = [
  { icon: "🏠", title: "Dashboard", description: "Your salon workspace" },
  { icon: "✂️", title: "Services", description: "View salon services" },
  { icon: "📅", title: "Appointments", description: "View salon bookings" },
  { icon: "👤", title: "My Profile", description: "View your account details" },
];

const dashboardItems =
  loggedInUser?.role === "admin"
    ? adminDashboardItems
    : loggedInUser?.role === "receptionist"
    ? receptionistDashboardItems
    : loggedInUser?.role === "stylist"
    ? stylistDashboardItems
    : customerDashboardItems;

    
  // ROLE PERMISSIONS
  const role = loggedInUser?.role || "customer";

  const canManageCustomers =
    role === "admin" || role === "receptionist";

  const canManageServices = role === "admin";

  const canManageAppointments =
    role === "admin" || role === "receptionist";

  const canBookAppointment =
    role === "customer" ||
    role === "admin" ||
    role === "receptionist";

  const canUpdateAppointmentStatus =
    role === "admin" || role === "receptionist";


  useEffect(() => {
    if (loggedInUser) setPage("dashboard");
  }, []);

  // LOGIN AND REGISTER
  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");

    const url =
      page === "register"
        ? `${API}/api/users/register/`
        : `${API}/api/users/login/`;

   
const body =
  page === "register"
    ? { full_name: fullName, email, phone, password }
    : { email, password, role: loginRole };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
  "Content-Type": "application/json",
  "X-User-Role": loggedInUser?.role || "customer",
  "X-User-Email": loggedInUser?.email || "",
},
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || data.message || "Please check your details.");
        return;
      }

      if (page === "register") {
        setMessage("Registration successful! Please login.");
        setPage("login");
        setFullName("");
        setPhone("");
        setPassword("");
        return;
      }

      localStorage.setItem("user", JSON.stringify(data.user));
      setLoggedInUser(data.user);
      setActiveSection("Dashboard");
      setPage("dashboard");
      setMessage("");
    } catch {
      setMessage("Backend connect होत नाही. Django server तपास.");
    }
  }

  function logout() {
    localStorage.removeItem("user");
    setLoggedInUser(null);
    setPage("login");
    setActiveSection("Dashboard");
    setEmail("");
    setPassword("");
    setMessage("");
  }

  // LOAD CUSTOMERS
  async function loadCustomers() {
    setLoadingCustomers(true);
    setCustomerError("");

    try {
      const response = await fetch(`${API}/api/salon/customers/`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Customers load झाले नाहीत.");
      }

      setCustomers(data);
    } catch (error) {
      setCustomerError(error.message || "Backend connection failed.");
    } finally {
      setLoadingCustomers(false);
    }
  }

  // LOAD SERVICES
  async function loadServices() {
    setLoadingServices(true);
    setServicesError("");

    try {
      const response = await fetch(`${API}/api/salon/services/`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Services load झाले नाहीत.");
      }

      setServices(data);
    } catch (error) {
      setServicesError(error.message || "Backend connection failed.");
    } finally {
      setLoadingServices(false);
    }
  }
  async function loadStaff() {
  try {
    const response = await fetch(`${API}/api/salon/staff/`);
    const data = await response.json();

    if (!response.ok || !Array.isArray(data)) {
      throw new Error("Staff list load झाली नाही.");
    }

    setStaffList(data.filter((person) => person.is_active !== false));
  } catch (error) {
    console.error("Staff loading error:", error);
  }
}

  // LOAD APPOINTMENTS
  // Admin/receptionist/stylist can see salon bookings; customers see only their own.
  async function loadAppointments() {
    setLoadingAppointments(true);
    setAppointmentError("");

    try {
      const response = await fetch(`${API}/api/salon/appointments/`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Appointments load झाल्या नाहीत.");
      }

      if (!Array.isArray(data)) {
        throw new Error(data.error || "Appointments data योग्य format मध्ये नाही.");
      }

      if (loggedInUser?.role === "customer") {
        const customerId = loggedInUser.customer_id;
        const customerName = (loggedInUser.full_name || loggedInUser.name || "")
          .trim()
          .toLowerCase();

        const ownAppointments = data.filter((appointment) => {
          if (customerId !== null && customerId !== undefined && customerId !== "") {
            return Number(appointment.customer_id) === Number(customerId);
          }
          return customerName !== "" &&
            (appointment.customer_name || "").trim().toLowerCase() === customerName;
        });

        setAppointments(ownAppointments);
      } else {
        setAppointments(data);
      }
    } catch (error) {
      setAppointments([]);
      setAppointmentError(error.message || "Backend connection failed.");
    } finally {
      setLoadingAppointments(false);
    }
  }

  useEffect(() => {
    if (page !== "dashboard") return;

    if (activeSection === "Customers") loadCustomers();
    if (activeSection === "Services") loadServices();

   if (activeSection === "Appointments") {
  loadCustomers();
  loadServices();
  loadStaff();
  loadAppointments();
}
  }, [page, activeSection]);

  async function viewCustomerHistory(customer) {
    setCustomerHistoryLoading(true);
    setCustomerHistoryError("");
    setCustomerHistory(null);

    try {
      const response = await fetch(
        `${API}/api/salon/customers/${customer.id}/history/`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Customer history load ???? ????.");
      }

      setCustomerHistory({ ...data, selectedCustomerName: customer.full_name });
    } catch (error) {
      setCustomerHistoryError(error.message || "Customer history load ???? ????.");
    } finally {
      setCustomerHistoryLoading(false);
    }
  }

  // CUSTOMER FORM: ADD, EDIT AND DELETE
  function handleCustomerInput(e) {
    const { name, value } = e.target;
    setCustomerForm((prev) => ({ ...prev, [name]: value }));
  }

  function openAddCustomerForm() {
    setEditingCustomerId(null);
    setCustomerForm({ full_name: "", email: "", phone: "", address: "" });
    setCustomerError("");
    setCustomerSuccess("");
    setShowCustomerForm(true);
  }

  function openEditCustomerForm(customer) {
    setEditingCustomerId(customer.id);
    setCustomerForm({
      full_name: customer.full_name || "",
      email: customer.email || "",
      phone: customer.phone || "",
      address: customer.address || "",
      notes: customer.notes || "",
      preferences: customer.preferences || "",
    });
    setCustomerError("");
    setCustomerSuccess("");
    setShowCustomerForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSaveCustomer(e) {
    e.preventDefault();
    setCustomerError("");
    setCustomerSuccess("");

    const isEditing = editingCustomerId !== null;
    const url = isEditing
      ? `${API}/api/salon/customers/${editingCustomerId}/edit/`
      : `${API}/api/salon/customers/`;

    try {
      const response = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customerForm),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || (isEditing ? "Customer update झाला नाही." : "Customer save झाला नाही."));
      }

      setCustomerForm({ full_name: "", email: "", phone: "", address: "" });
      setEditingCustomerId(null);
      setShowCustomerForm(false);
      setCustomerSuccess(isEditing ? "Customer successfully updated!" : "Customer successfully saved!");
      await loadCustomers();
    } catch (error) {
      setCustomerError(error.message || "Customer save/update झाला नाही.");
    }
  }

  async function handleDeleteCustomer(customer) {
    const confirmed = window.confirm(`Delete customer ${customer.full_name}?`);
    if (!confirmed) return;

    setCustomerError("");
    setCustomerSuccess("");
    try {
      const response = await fetch(`${API}/api/salon/customers/${customer.id}/delete/`, {
        method: "DELETE",
      });
      let data = {};
      try { data = await response.json(); } catch { /* Empty response is allowed. */ }
      if (!response.ok) {
        throw new Error(data.error || "Customer delete झाला नाही.");
      }
      if (editingCustomerId === customer.id) {
        setEditingCustomerId(null);
        setShowCustomerForm(false);
        setCustomerForm({ full_name: "", email: "", phone: "", address: "" });
      }
      setCustomerSuccess("Customer successfully deleted!");
      await loadCustomers();
    } catch (error) {
      setCustomerError(error.message || "Customer delete झाला नाही.");
    }
  }

  // SERVICE FORM
  function handleServiceInput(e) {
    const { name, value } = e.target;
    setServiceForm((prev) => ({ ...prev, [name]: value }));
  }

  function openAddServiceForm() {
    setEditingServiceId(null);
    setServiceForm({
      name: "",
      description: "",
      price: "",
      duration_minutes: 30,
      image_url: "",
    });
    setServicesError("");
    setServiceSuccess("");
    setShowServiceForm(true);
  }

  function openEditServiceForm(service) {
    setEditingServiceId(service.id);
    setServiceForm({
      name: service.name,
      description: service.description || "",
      price: service.price,
      duration_minutes: service.duration_minutes,
      image_url: service.image_url || "",
    });
    setServicesError("");
    setServiceSuccess("");
    setShowServiceForm(true);
  }

  async function handleSaveService(e) {
    e.preventDefault();
    setServicesError("");
    setServiceSuccess("");

    try {
      const editing = editingServiceId !== null;
      const url = editing
        ? `${API}/api/salon/services/${editingServiceId}/edit/`
        : `${API}/api/salon/services/add/`;

      const response = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...serviceForm,
          price: Number(serviceForm.price),
          duration_minutes: Number(serviceForm.duration_minutes),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Service save झाली नाही.");
      }

      await loadServices();
      setShowServiceForm(false);
      setEditingServiceId(null);
      setServiceSuccess(
        editing
          ? "Service updated successfully!"
          : "Service added successfully!"
      );
    } catch (error) {
      setServicesError(error.message || "Service save झाली नाही.");
    }
  }

  async function handleDeleteService(service) {
    if (!window.confirm(`Delete "${service.name}" service?`)) return;

    setServicesError("");
    setServiceSuccess("");

    try {
      const response = await fetch(
        `${API}/api/salon/services/${service.id}/delete/`,
        { method: "DELETE" }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Service delete झाली नाही.");
      }

      await loadServices();
      setServiceSuccess("Service deleted successfully!");
    } catch (error) {
      setServicesError(error.message || "Service delete झाली नाही.");
    }
  }

  // APPOINTMENT FORM
  function handleAppointmentInput(e) {
    const { name, value } = e.target;
    setAppointmentForm((prev) => ({ ...prev, [name]: value }));
  }

  function resetAppointmentForm() {
   setAppointmentForm({
  customer_id: "",
  staff_id: "",
  service_id: "",
  appointment_date: "",
  appointment_time: "",
  notes: "",
});
    setEditingAppointmentId(null);
  }

  function openNewAppointmentForm() {
    resetAppointmentForm();
    setAppointmentError("");
    setAppointmentSuccess("");
    setShowAppointmentForm(true);
  }

  function openEditAppointmentForm(appointment) {
    setEditingAppointmentId(appointment.id);
   setAppointmentForm({
  customer_id: String(appointment.customer_id),
  staff_id: String(appointment.staff_id || ""),
  service_id: String(appointment.service_id),
  appointment_date: appointment.appointment_date,
  appointment_time: appointment.appointment_time,
  notes: appointment.notes || "",
});
    setAppointmentError("");
    setAppointmentSuccess("");
    setShowAppointmentForm(true);
  }

  async function handleBookAppointment(e) {
    e.preventDefault();
    setAppointmentError("");
    setAppointmentSuccess("");

    try {
      const editing = editingAppointmentId !== null;
      const url = editing
        ? `${API}/api/salon/appointments/${editingAppointmentId}/edit/`
        : `${API}/api/salon/appointments/`;

      const response = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        headers: {
  "Content-Type": "application/json",
  "X-User-Role": loggedInUser?.role || "customer",
  "X-User-Email": loggedInUser?.email || "",
},
       body: JSON.stringify({
  ...appointmentForm,
  customer_id: Number(
    role === "customer"
      ? loggedInUser.customer_id || loggedInUser.id
      : appointmentForm.customer_id
  ),
  service_id: Number(appointmentForm.service_id),
}),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Appointment save झाली नाही.");
      }

      setAppointmentSuccess(
        editing
          ? "Appointment updated successfully!"
          : "Appointment booked successfully!"
      );

      resetAppointmentForm();
      setShowAppointmentForm(false);
      await loadAppointments();
    } catch (error) {
      setAppointmentError(error.message || "Appointment save झाली नाही.");
    }
  }

  async function handleDeleteAppointment(appointment) {
    const confirmed = window.confirm(
      `Delete appointment #${appointment.id} for ${appointment.customer_name}?`
    );
    if (!confirmed) return;

    setAppointmentError("");
    setAppointmentSuccess("");

    try {
      const response = await fetch(
        `${API}/api/salon/appointments/${appointment.id}/delete/`,
        {
          method: "DELETE",
          headers: {
            "X-User-Role": loggedInUser?.role || "customer",
            "X-User-Email": loggedInUser?.email || "",
          },
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Appointment delete झाली नाही.");
      }

      setAppointmentSuccess("Appointment deleted successfully!");
      await loadAppointments();
    } catch (error) {
      setAppointmentError(error.message || "Appointment delete झाली नाही.");
    }
  }

 
async function changeAppointmentStatus(id, status) {
  setAppointmentError("");
  setAppointmentSuccess("");

  try {
    const response = await fetch(
      `${API}/api/salon/appointments/${id}/status/`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-User-Role": loggedInUser?.role || "customer",
          "X-User-Email": loggedInUser?.email || "",
        },
        body: JSON.stringify({ status }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Status update झाला नाही."
      );
    }

    setAppointmentSuccess("Appointment status updated!");
    await loadAppointments();
  } catch (error) {
    setAppointmentError(
      error.message || "Status update झाला नाही."
    );
  }
}


  // NAVIGATION
  function openSection(title) {
    setActiveSection(title);
    setCustomerError("");
    setCustomerSuccess("");
    setServicesError("");
    setServiceSuccess("");
    setAppointmentError("");
    setAppointmentSuccess("");
    setShowCustomerForm(false);
    setEditingCustomerId(null);
    setCustomerForm({ full_name: "", email: "", phone: "", address: "" });
    setShowServiceForm(false);
    setShowAppointmentForm(false);
    setEditingAppointmentId(null);
    setEditingServiceId(null);

    
if (
  ![
  "Dashboard",
  "Customers",
  "Services",
  "Packages",
  "Appointments",
  "Staff",
  "Staff Scheduling",
  "Billing & Payments",
  "Reports",
  "Notifications",
  "My Profile",
].includes(title)
) {
  alert(`${title} page पुढच्या टप्प्यात तयार करू.`);
}
  }

  // SERVICE IMAGES
  function getServiceImage(service) {
    if (service.image_url && service.image_url.trim()) {
      return service.image_url;
    }

    const name = service.name.toLowerCase();

    if (name.includes("haircut") || name.includes("hair cut")) {
      return "https://images.unsplash.com/photo-1562322140-8baeececf3df?w=700&auto=format&fit=crop";
    }
    if (name.includes("hair")) {
      return "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=700&auto=format&fit=crop";
    }
    if (name.includes("facial")) {
      return "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=700&auto=format&fit=crop";
    }
    if (name.includes("bridal") || name.includes("makeup")) {
      return "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=700&auto=format&fit=crop";
    }
    if (name.includes("wax")) {
      return "https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=700&auto=format&fit=crop";
    }

    return "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=700&auto=format&fit=crop";
  }

  // DASHBOARD
  if (page === "dashboard" && loggedInUser) {
    return (
      <div className="dashboard-page">
        <aside className="dashboard-sidebar">
          <div className="dashboard-brand">
            <span>♡</span>
            <h2>Glow Beauty</h2>
            <p>Beauty Salon Management</p>
          </div>

          <nav className="dashboard-nav">
            {dashboardItems.map((item) => (
              <button
                key={item.title}
                className={
                  activeSection === item.title
                    ? "dashboard-nav-button active"
                    : "dashboard-nav-button"
                }
                onClick={() => openSection(item.title)}
              >
                <span>{item.icon}</span>
                {item.title}
              </button>
            ))}
          </nav>

          <button className="logout-button" onClick={logout}>
            🚪 Logout
          </button>
        </aside>

        <main className="dashboard-main">
          <header className="dashboard-header">
            <div>
              <p className="dashboard-small-title">SALON MANAGEMENT</p>
              <h1>{activeSection}</h1>
              <p>Welcome to Glow Beauty Salon!</p>
            </div>

            <div className="profile-box">
              <div className="profile-avatar">
                {(loggedInUser.full_name || "U").charAt(0).toUpperCase()}
              </div>
              <div>
                <strong>{loggedInUser.full_name || "User"}</strong>
                <p>{loggedInUser.role || "customer"}</p>
              </div>
            </div>
          </header>

          {/* DASHBOARD HOME */}
          {activeSection === "Dashboard" && (
            <>
              <section className="welcome-card">
                <div>
                  <p>WELCOME TO GLOW BEAUTY SALON</p>
                  <h2>Your Beauty, Our Priority ♡</h2>
                  <span>
                    {loggedInUser.role === "admin"
                      ? "Manage your salon activities from one place."
                      : "Explore our services and manage your beauty appointments."}
                  </span>
                  {loggedInUser.role !== "admin" && (
                    <button
                      type="button"
                      className="add-customer-button"
                      onClick={() => openSection("Appointments")}
                      style={{ marginTop: "18px" }}
                    >
                      📅 Book Appointment
                    </button>
                  )}
                </div>
                <div className="welcome-heart">♡</div>
              </section>

              <h2 className="section-heading">
                {loggedInUser.role === "admin" ? "Salon Management" : "Explore Glow Beauty"}
              </h2>
              <section className="dashboard-cards">
                {dashboardItems.map((item) => (
                  <button
                    className="dashboard-card"
                    key={item.title}
                    onClick={() => openSection(item.title)}
                  >
                    <div className="dashboard-card-icon">{item.icon}</div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <span className="card-arrow">View details →</span>
                  </button>
                ))}
              </section>
            </>
          )}

          {/* CUSTOMERS */}
          {activeSection === "Customers" && (
            <section className="customers-section">
              <div className="customers-heading">
                <div>
                  <h2>Customer Management ♡</h2>
                </div>
               
{canManageCustomers && (
  <button
    className="add-customer-button"
    onClick={() => {
      if (showCustomerForm) {
        setShowCustomerForm(false);
        setEditingCustomerId(null);
      } else {
        openAddCustomerForm();
      }
      setCustomerError("");
      setCustomerSuccess("");
    }}
  >
    {showCustomerForm ? "Cancel" : "+ Add Customer"}
  </button>
)}

              </div>

              {customerSuccess && (
                <p className="customer-success">{customerSuccess}</p>
              )}
              {customerError && (
                <p className="customer-error">{customerError}</p>
              )}

              {showCustomerForm && (
                <form className="customer-form" onSubmit={handleSaveCustomer}>
                  <h3>{editingCustomerId !== null ? "Edit Customer" : "Add New Customer"}</h3>

                  <label>Full Name</label>
                  <input
                    name="full_name"
                    value={customerForm.full_name}
                    onChange={handleCustomerInput}
                    placeholder="Enter customer name"
                    required
                  />

                  <label>Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={customerForm.email}
                    onChange={handleCustomerInput}
                    placeholder="Enter email address"
                    required
                  />

                  <label>Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    value={customerForm.phone}
                    onChange={handleCustomerInput}
                    placeholder="Enter phone number"
                    required
                  />

                  <label>Address</label>
                  <textarea
                    name="address"
                    value={customerForm.address}
                    onChange={handleCustomerInput}
                    placeholder="Enter address (optional)"
                    rows="3"
                  />

                  <label>Customer Notes (Optional)</label>
                  <textarea
                    name="notes"
                    value={customerForm.notes}
                    onChange={handleCustomerInput}
                    placeholder="Important notes about this customer"
                    rows="2"
                  />

                  <label>Customer Preferences (Optional)</label>
                  <textarea
                    name="preferences"
                    value={customerForm.preferences}
                    onChange={handleCustomerInput}
                    placeholder="Preferred services or products"
                    rows="2"
                  />

                  <button type="submit" className="save-customer-button">
                    {editingCustomerId !== null ? "Update Customer" : "Save Customer"}
                  </button>
                </form>
              )}

              <div className="customer-search">
                <input
                  type="text"
                  placeholder="Search by name, email or phone..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
                <button type="button" className="refresh-customers-button" onClick={() => setCustomerSearch("")}>
                  Clear
                </button>
              </div>

              <div className="customer-list-heading">
                <h3>All Customers</h3>
                <button
                  className="refresh-customers-button"
                  onClick={loadCustomers}
                >
                  ↻ Refresh
                </button>
              </div>

              {loadingCustomers ? (
                <p>Loading customers...</p>
              ) : customers.length === 0 ? (
                <div className="empty-customers">
                  <span>👥</span>
                  <h3>No Customers Yet</h3>
                </div>
              ) : (
                <div className="customer-table-wrapper">
                  <table className="customer-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Full Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Address</th>
                        {canManageCustomers && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {customers.filter((customer) => {
                        const search = customerSearch.trim().toLowerCase();
                        return (
                          (customer.full_name || "").toLowerCase().includes(search) ||
                          (customer.email || "").toLowerCase().includes(search) ||
                          (customer.phone || "").toLowerCase().includes(search)
                        );
                      }).map((customer) => (
                        <tr key={customer.id}>
                          <td>{customer.id}</td>
                          <td>{customer.full_name}</td>
                          <td>{customer.email}</td>
                          <td>{customer.phone}</td>
                          <td>{customer.address || "—"}</td>
                          {canManageCustomers && (
                            <td>
                              <div className="customer-row-actions">
                                <button
                                  type="button"
                                  className="edit-customer-button"
                                  onClick={() => openEditCustomerForm(customer)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="delete-customer-button"
                                  onClick={() => handleDeleteCustomer(customer)}
                                >
                                  Delete
                                </button>
                                <button
                                  type="button"
                                  className="edit-customer-button"
                                  onClick={() => viewCustomerHistory(customer)}
                                >
                                  History
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {customerHistoryLoading && <p>Loading customer history...</p>}
              {customerHistoryError && <p className="error-message">{customerHistoryError}</p>}
              {customerHistory && (
                <div className="customer-history-panel">
                  <h3>Customer History: {customerHistory.selectedCustomerName}</h3>
                  <button
                    type="button"
                    className="delete-customer-button"
                    onClick={() => {
                      setCustomerHistory(null);
                      setCustomerHistoryError("");
                    }}
                  >
                    Close History
                  </button>

                  <h4>Appointments</h4>
                  {customerHistory.appointments?.length ? (
                    <div className="table-container">
                      <table className="customer-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Time</th>
                            <th>Service</th>
                            <th>Staff</th>
                            <th>Status</th>
                            <th>Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customerHistory.appointments.map((item, index) => (
                            <tr key={item.id || index}>
                              <td>{item.date || item.appointment_date || "?"}</td>
                              <td>{item.time || item.appointment_time || "?"}</td>
                              <td>{item.service || item.service_name || "?"}</td>
                              <td>{item.staff || item.staff_name || "?"}</td>
                              <td>{item.status || "?"}</td>
                              <td>{item.price ?? "?"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p>No appointment history found.</p>}

                  <h4>Bills</h4>
                  {customerHistory.bills?.length ? (
                    <div className="table-container">
                      <table className="customer-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Service</th>
                            <th>Amount</th>
                            <th>Payment Method</th>
                            <th>Payment Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customerHistory.bills.map((item, index) => (
                            <tr key={item.id || index}>
                              <td>{item.created_at ? new Date(item.created_at).toLocaleDateString() : "?"}</td>
                              <td>{item.service || item.service_name || "?"}</td>
                              <td>{item.total_amount ?? "?"}</td>
                              <td>{item.payment_method || "?"}</td>
                              <td>{item.payment_status || item.status || "?"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p>No billing history found.</p>}
                </div>
              )}
            </section>
          )}

          {/* SERVICES */}
          {activeSection === "Services" && (
            <section className="services-section">
              <div className="services-heading">
                <div>
                  <h2>Our Beauty Services ♡</h2>
                  <p>Manage your professional salon services and prices.</p>
                </div>

                <div className="service-actions">
                  <button
                    className="add-customer-button"
                    onClick={openAddServiceForm}
                  >
                    + Add Service
                  </button>
                  <button
                    className="refresh-customers-button"
                    onClick={loadServices}
                  >
                    ↻ Refresh
                  </button>
                </div>
              </div>

              {servicesError && (
                <p className="customer-error">{servicesError}</p>
              )}
              {serviceSuccess && (
                <p className="customer-success">{serviceSuccess}</p>
              )}

              {showServiceForm && (
                <form className="service-form" onSubmit={handleSaveService}>
                  <h3>
                    {editingServiceId !== null
                      ? "Edit Service"
                      : "Add New Service"}
                  </h3>

                  <label>Service Name</label>
                  <input
                    name="name"
                    value={serviceForm.name}
                    onChange={handleServiceInput}
                    placeholder="Enter service name"
                    required
                  />

                  <label>Description</label>
                  <textarea
                    name="description"
                    value={serviceForm.description}
                    onChange={handleServiceInput}
                    placeholder="Enter description"
                    rows="3"
                  />

                  <label>Price (₹)</label>
                  <input
                    type="number"
                    name="price"
                    value={serviceForm.price}
                    onChange={handleServiceInput}
                    min="0"
                    step="0.01"
                    required
                  />

                  <label>Duration (minutes)</label>
                  <input
                    type="number"
                    name="duration_minutes"
                    value={serviceForm.duration_minutes}
                    onChange={handleServiceInput}
                    min="1"
                    required
                  />

                  <label>Image URL</label>
                  <input
                    type="url"
                    name="image_url"
                    value={serviceForm.image_url}
                    onChange={handleServiceInput}
                    placeholder="https://example.com/image.jpg"
                  />

                  <div className="service-form-actions">
                    <button type="submit" className="save-customer-button">
                      {editingServiceId !== null
                        ? "Update Service"
                        : "Save Service"}
                    </button>
                    <button
                      type="button"
                      className="refresh-customers-button"
                      onClick={() => {
                        setShowServiceForm(false);
                        setEditingServiceId(null);
                        setServicesError("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {loadingServices ? (
                <p>Loading services...</p>
              ) : services.length === 0 ? (
                <div className="empty-customers">
                  <h3>No Services Available</h3>
                  <p>Click Add Service to create your first service.</p>
                </div>
              ) : (
                <div className="services-grid">
                  {services.map((service) => (
                    <article className="service-card" key={service.id}>
                      <div className="service-card-image">
                        <img
                          src={getServiceImage(service)}
                          alt={service.name}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src =
                              "https://placehold.co/700x450/f8eaf0/80556a?text=Glow+Beauty+Salon";
                          }}
                        />
                      </div>

                      <div className="service-card-content">
                        <div className="service-card-title-row">
                          <h3>{service.name}</h3>
                          <span className="service-active-badge">Active</span>
                        </div>
                        <p className="service-description">
                          {service.description ||
                            "Professional salon service."}
                        </p>
                        <div className="service-card-bottom">
                          <strong>
                            ₹{Number(service.price).toLocaleString("en-IN")}
                          </strong>
                          <span>◷ {service.duration_minutes} minutes</span>
                        </div>
                        <div className="service-card-actions">
                          <button
                            type="button"
                            className="edit-service-button"
                            onClick={() => openEditServiceForm(service)}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            className="delete-service-button"
                            onClick={() => handleDeleteService(service)}
                          >
                            🗑 Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* APPOINTMENTS */}
          {activeSection === "Appointments" && (
            <section className="customers-section appointments-page">
              <div className="customers-heading">
                <div>
                  <h2>Appointment Booking ♡</h2>
                  <p>Manage your salon appointments.</p>
                </div>

                <div className="service-actions">
                  <button
                    className="add-customer-button"
                    onClick={() => {
                      if (showAppointmentForm) {
                        setShowAppointmentForm(false);
                        resetAppointmentForm();
                      } else {
                        openNewAppointmentForm();
                      }
                    }}
                  >
                    {showAppointmentForm
                      ? "Cancel"
                      : "+ Book Appointment"}
                  </button>

                  <button
                    className="refresh-customers-button"
                    onClick={() => {
                      loadCustomers();
                      loadServices();
                      loadAppointments();
                    }}
                  >
                    ↻ Refresh
                  </button>
                </div>
              </div>

              {appointmentSuccess && (
                <p className="customer-success">{appointmentSuccess}</p>
              )}
              {appointmentError && (
                <p className="customer-error">{appointmentError}</p>
              )}

              {showAppointmentForm && (
                <form
                  className="customer-form"
                  onSubmit={handleBookAppointment}
                >
                  <h3>
                    {editingAppointmentId !== null
                      ? "Edit Appointment"
                      : "Book New Appointment"}
                  </h3>

                  <label>Customer</label>

{role === "customer" ? (
  <input
    type="text"
    value={loggedInUser.full_name || loggedInUser.name || ""}
    readOnly
  />
) : (
  <select
    name="customer_id"
    value={appointmentForm.customer_id}
    onChange={handleAppointmentInput}
    required
  >
    <option value="">Select Customer</option>
    {customers.map((customer) => (
      <option key={customer.id} value={customer.id}>
        {customer.full_name} - {customer.phone}
      </option>
    ))}
  </select>
)}

<label>Choose Staff / Beautician</label>
<select
  name="staff_id"
  value={appointmentForm.staff_id || ""}
  onChange={handleAppointmentInput}
  required
>
  <option value="">Select Staff</option>
  {staffList.map((person) => (
    <option key={person.id} value={person.id}>
      {person.full_name} - {person.role}
    </option>
  ))}
</select>
                  <label>Salon Service</label>
                  <select
                    name="service_id"
                    value={appointmentForm.service_id}
                    onChange={handleAppointmentInput}
                    required
                  >
                    <option value="">Select Service</option>
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name} - ₹{service.price}
                      </option>
                    ))}
                  </select>

                  <label>Appointment Date</label>
                  <input
                    type="date"
                    name="appointment_date"
                    min={new Date().toLocaleDateString("en-CA")}
                    value={appointmentForm.appointment_date}
                    onChange={handleAppointmentInput}
                    required
                  />

                  <label>Appointment Time</label>
                  <input
                    type="time"
                    name="appointment_time"
                    value={appointmentForm.appointment_time}
                    onChange={handleAppointmentInput}
                    required
                  />

                  <label>Notes (Optional)</label>
                  <textarea
                    name="notes"
                    rows="3"
                    placeholder="Any special requests..."
                    value={appointmentForm.notes}
                    onChange={handleAppointmentInput}
                  />

                  <div className="service-form-actions">
                    <button type="submit" className="save-customer-button">
                      {editingAppointmentId !== null
                        ? "Update Appointment"
                        : "Confirm Appointment"}
                    </button>

                    <button
                      type="button"
                      className="refresh-customers-button"
                      onClick={() => {
                        setShowAppointmentForm(false);
                        resetAppointmentForm();
                        setAppointmentError("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="customer-list-heading">
                <h3>All Appointments</h3>
              </div>

              {loadingAppointments ? (
                <p>Loading appointments...</p>
              ) : appointments.length === 0 ? (
                <div className="empty-customers">
                  <span>📅</span>
                  <h3>No Appointments Yet</h3>
                  <p>
                    Click Book Appointment to create your first booking.
                  </p>
                </div>
              ) : (
                <div className="customer-table-wrapper">
                  <table className="customer-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Customer</th>
                        <th>Staff</th>
                        <th>Service</th>
                        <th>Price</th>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Notes</th>
                        <th>Status</th>
                        <th>Update Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...appointments]
  .sort((a, b) => a.id - b.id)
  .map((appointment) => (
                        <tr key={appointment.id}>
                          <td>{appointment.id}</td>
                          <td>{appointment.customer_name}</td>
                          <td>{appointment.staff_name || "—"}</td>
                          <td>{appointment.service_name}</td>
                          <td>₹{appointment.price}</td>
                          <td>{appointment.appointment_date}</td>
                          <td>{appointment.appointment_time}</td>
                          <td>{appointment.notes || "—"}</td>
                          <td>{appointment.status}</td>
                          <td>
                            <select
                              value={appointment.status}
                              onChange={(e) =>
                                changeAppointmentStatus(
                                  appointment.id,
                                  e.target.value
                                )
                              }
                            >
                              <option value="pending">Pending</option>
                              <option value="confirmed">Confirmed</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </td>
                          
<td>
  <div className="service-card-actions appointment-actions">
    <button
      type="button"
      className="edit-service-button"
      onClick={() => openEditAppointmentForm(appointment)}
    >
      ✏️ Edit
    </button>

    <button
      type="button"
      className="delete-service-button"
      onClick={() => handleDeleteAppointment(appointment)}
    >
      🗑 Delete
    </button>
  </div>
</td>

                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
          
{/* STAFF MANAGEMENT */}
{activeSection === "Staff" && <Staff />}
{activeSection === "Staff Scheduling" && <StaffScheduling />}
{/* BILLING & PAYMENTS */}
{activeSection === "Billing & Payments" && <Billing />}
{/* PACKAGES */}
{activeSection === "Packages" && <Packages />}
{/* REPORTS */}
{activeSection === "Reports" && <Reports />}
{activeSection === "Notifications" && <Notifications />}

{/* MY PROFILE */}
{activeSection === "My Profile" && (
  <section className="customers-section my-profile-section">
    <div className="customers-heading">
      <div>
        <h2>My Profile ♡</h2>
        <p>Your Glow Beauty Salon account details.</p>
      </div>
    </div>

    <div className="customer-form profile-details-card">
      <div className="profile-avatar profile-details-avatar">
        {(loggedInUser.full_name || loggedInUser.name || "U").charAt(0).toUpperCase()}
      </div>
      <h3>{loggedInUser.full_name || loggedInUser.name || "User"}</h3>
      <p className="profile-role-label">{loggedInUser.role || "customer"}</p>

      <div className="profile-detail-row">
        <strong>Full Name</strong>
        <span>{loggedInUser.full_name || loggedInUser.name || "—"}</span>
      </div>
      <div className="profile-detail-row">
        <strong>Email Address</strong>
        <span>{loggedInUser.email || "—"}</span>
      </div>
      <div className="profile-detail-row">
        <strong>Phone Number</strong>
        <span>{loggedInUser.phone || "Not provided"}</span>
      </div>
      <div className="profile-detail-row">
        <strong>Account Role</strong>
        <span>{loggedInUser.role || "customer"}</span>
      </div>
    </div>
  </section>
)}

          <footer className="dashboard-footer">
            © 2026 Glow Beauty Salon | Your Beauty, Our Priority
          </footer>
        </main>
      </div>
    );
  }

  // LOGIN AND REGISTER
  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-banner">
          <div className="banner-content">
            <div className="brand-heart">♡</div>
            <h1>Glow Beauty Salon</h1>
            <p>Your Beauty, Our Priority</p>
            <div className="pink-line">♡ ━━━━━━━━━ ♡</div>
            <span>Feel Beautiful. Feel Confident.</span>
          </div>
        </div>

        <div className="auth-form">
          <div className="heart-logo">♡</div>

          {page === "login" ? (
            <>
              <h2>Welcome Back!</h2>
              <p className="subtitle">Please login to your account</p>
            </>
          ) : (
            <>
              <h2>Create Your Account</h2>
              <p className="subtitle">Join Glow Beauty Salon today</p>
            </>
          )}

          <form onSubmit={handleSubmit}>
            
{page === "login" && (
  <div className="role-selection">
    <label>Login As</label>

  
<div className="role-options">
  {[
    { role: "customer", label: "👤 Customer" },
    { role: "admin", label: "👑 Admin" },
    { role: "receptionist", label: "📋 Receptionist" },
    { role: "stylist", label: "💇 Stylist" },
  ].map((item) => (
    <button
      key={item.role}
      type="button"
      className={
        loginRole === item.role
          ? "role-button selected"
          : "role-button"
      }
      onClick={() => setLoginRole(item.role)}
    >
      {item.label}
    </button>
  ))}
</div>

  </div>
)}

            {page === "register" && (
              <>
                <label>Full Name</label>
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </>
            )}

            <label>Email Address</label>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            {page === "register" && (
              <>
                <label>Phone Number</label>
                <input
                  type="tel"
                  placeholder="Enter your phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </>
            )}

            <label>Password</label>
            <div className="password-box">
              <input
                type={showPassword ? "text" : "password"}
                placeholder={
                  page === "register"
                    ? "Create password (minimum 8 characters)"
                    : "Enter your password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={page === "register" ? 8 : undefined}
                required
              />
              <button
                type="button"
                className="show-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {page === "login" && (
              <div className="form-options">
                <label className="remember">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  className="forgot-button"
                  onClick={() =>
                    setMessage(
                      "Please contact the salon administrator to reset your password."
                    )
                  }
                >
                  Forgot Password?
                </button>
              </div>
            )}

            <button type="submit" className="main-button">
              {page === "login" ? "Login" : "Register"}
            </button>
          </form>

          {message && <p className="status-message">{message}</p>}

          <div className="or-divider">
            <span></span>
            <p>OR</p>
            <span></span>
          </div>

          <p className="switch-page">
            {page === "login"
              ? "Don't have an account?"
              : "Already have an account?"}
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setPage(page === "login" ? "register" : "login");
                setMessage("");
                setPassword("");
              }}
            >
              {page === "login" ? "Register" : "Login"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
