
import { useEffect, useState } from "react";
import "./Billing.css";

const API = `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/api/salon/`;

function Billing() {
  const [bills, setBills] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [appointments, setAppointments] = useState([]);

  const [customerId, setCustomerId] = useState("");
  const [appointmentId, setAppointmentId] = useState("");
  const [amount, setAmount] = useState("");
  const [discount, setDiscount] = useState("0");
  const [charges, setCharges] = useState("0");
  const [tax, setTax] = useState("0");
  const [method, setMethod] = useState("cash");
  const [status, setStatus] = useState("pending");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Edit Bill form state
  const [editingBillId, setEditingBillId] = useState(null);
  const [editCustomerId, setEditCustomerId] = useState("");
  const [editAppointmentId, setEditAppointmentId] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDiscount, setEditDiscount] = useState("0");
  const [editCharges, setEditCharges] = useState("0");
  const [editTax, setEditTax] = useState("0");
  const [editMethod, setEditMethod] = useState("cash");
  const [editStatus, setEditStatus] = useState("pending");
  const [editLoading, setEditLoading] = useState(false);

  async function loadData() {
    try {
      setError("");

      const [billRes, customerRes, appointmentRes] =
        await Promise.all([
          fetch(`${API}bills/`),
          fetch(`${API}customers/`),
          fetch(`${API}appointments/`),
        ]);

      if (!billRes.ok || !customerRes.ok || !appointmentRes.ok) {
        throw new Error("Data load झाले नाही. Backend तपासा.");
      }

      const billData = await billRes.json();
      const customerData = await customerRes.json();
      const appointmentData = await appointmentRes.json();

      setBills(Array.isArray(billData) ? billData : []);
      setCustomers(
        Array.isArray(customerData)
          ? customerData
          : customerData.results || []
      );
      setAppointments(
        Array.isArray(appointmentData)
          ? appointmentData
          : appointmentData.results || []
      );
    } catch (err) {
      setError(err.message || "Data load करताना error आला.");
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const selectedAppointments = appointments.filter(
    (appointment) =>
      String(appointment.customer_id ?? appointment.customer) ===
      String(customerId)
  );

  async function createBill(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API}bills/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_id: Number(customerId),
          appointment_id: appointmentId || null,
          subtotal_amount: amount,
          discount_amount: discount,
          additional_charges: charges,
          tax_amount: tax,
          total_amount: amount,
          payment_method: method,
          payment_status: status,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Bill create झाला नाही.");
      }

      setMessage("Bill successfully create झाला!");
      setCustomerId("");
      setAppointmentId("");
      setAmount("");
      setDiscount("0");
      setCharges("0");
      setTax("0");
      setMethod("cash");
      setStatus("pending");

      await loadData();
    } catch (err) {
      setError(err.message || "Bill create करताना error आला.");
    } finally {
      setLoading(false);
    }
  }

  function startEditBill(bill) {
    setError("");
    setMessage("");
    setEditingBillId(bill.id);
    setEditCustomerId(String(bill.customer_id ?? ""));
    setEditAppointmentId(bill.appointment_id ? String(bill.appointment_id) : "");
    setEditAmount(String(bill.subtotal_amount ?? bill.total_amount ?? ""));
    setEditDiscount(String(bill.discount_amount ?? "0"));
    setEditCharges(String(bill.additional_charges ?? "0"));
    setEditTax(String(bill.tax_amount ?? "0"));
    setEditMethod(bill.payment_method || "cash");
    setEditStatus(bill.payment_status || "pending");
  }

  function cancelEditBill() {
    setEditingBillId(null);
    setEditCustomerId("");
    setEditAppointmentId("");
    setEditAmount("");
    setEditDiscount("0");
    setEditCharges("0");
    setEditTax("0");
    setEditMethod("cash");
    setEditStatus("pending");
  }

  const editSelectedAppointments = appointments.filter(
    (appointment) =>
      String(appointment.customer_id ?? appointment.customer) ===
      String(editCustomerId)
  );

  async function saveEditedBill(event) {
    event.preventDefault();
    if (!editingBillId) return;

    setEditLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API}bills/${editingBillId}/update/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: Number(editCustomerId),
          appointment_id: editAppointmentId || null,
          subtotal_amount: editAmount,
          discount_amount: editDiscount,
          additional_charges: editCharges,
          tax_amount: editTax,
          total_amount: editAmount,
          payment_method: editMethod,
          payment_status: editStatus,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Bill update झाला नाही.");
      }

      setMessage("Bill successfully update झाला!");
      cancelEditBill();
      await loadData();
    } catch (err) {
      setError(err.message || "Bill update करताना error आला.");
    } finally {
      setEditLoading(false);
    }
  }

  async function updateStatus(billId, newStatus) {
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API}bills/${billId}/update/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payment_status: newStatus,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Payment status update झाला नाही.");
      }

      setMessage("Payment status update झाला!");
      await loadData();
    } catch (err) {
      setError(err.message || "Status update करताना error आला.");
    }
  }

  async function deleteBill(billId) {
    const confirmDelete = window.confirm(
      "हा bill delete करायचा आहे का?"
    );

    if (!confirmDelete) return;

    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API}bills/${billId}/delete/`, {
        method: "DELETE",
      });

      if (!response.ok) {
        let data = {};
        try {
          data = await response.json();
        } catch {
          // Response मध्ये JSON नसेल तर default error दाखवू.
        }
        throw new Error(data.error || "Bill delete झाला नाही.");
      }

      setMessage("Bill delete झाला!");
      await loadData();
    } catch (err) {
      setError(err.message || "Bill delete करताना error आला.");
    }
  }

  const paidBills = bills.filter(
    (bill) => bill.payment_status === "paid"
  ).length;

  const pendingAmount = bills
    .filter((bill) => bill.payment_status === "pending")
    .reduce(
      (total, bill) => total + Number(bill.total_amount || 0),
      0
    );

  return (
    <div className="billing-page">
      {/* App.jsx मध्ये मुख्य heading आधीच आहे.
          म्हणून इथे duplicate heading ठेवलेला नाही. */}
      <div className="billing-heading">
        <p>Manage salon bills and payment records</p>
      </div>

      {message && (
        <div className="billing-success">{message}</div>
      )}

      {error && (
        <div className="billing-error">{error}</div>
      )}

      <div className="billing-stats">
        <div className="billing-stat">
          <span>Total Bills</span>
          <h3>{bills.length}</h3>
        </div>

        <div className="billing-stat">
          <span>Paid Bills</span>
          <h3>{paidBills}</h3>
        </div>

        <div className="billing-stat">
          <span>Pending Amount</span>
          <h3>₹{pendingAmount.toLocaleString("en-IN")}</h3>
        </div>
      </div>

      <form className="billing-form" onSubmit={createBill}>
        <h3>Create New Bill</h3>

        <label>Customer</label>
        <select
          value={customerId}
          onChange={(event) => {
            setCustomerId(event.target.value);
            setAppointmentId("");
            setAmount("");
          }}
          required
        >
          <option value="">Select Customer</option>

          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.full_name || customer.name}
            </option>
          ))}
        </select>

        <label>Appointment (Optional)</label>
        <select
          value={appointmentId}
          onChange={(event) => {
            const id = event.target.value;
            setAppointmentId(id);

            const appointment = appointments.find(
              (item) => String(item.id) === id
            );

            if (appointment) {
              setAmount(
                String(
                  appointment.price ??
                    appointment.service_price ??
                    ""
                )
              );
            }
          }}
        >
          <option value="">No Appointment Selected</option>

          {selectedAppointments.map((appointment) => (
            <option key={appointment.id} value={appointment.id}>
              {appointment.service_name ||
                appointment.service ||
                "Appointment"}{" "}
              — {appointment.appointment_date || ""}
            </option>
          ))}
        </select>

        <label>Subtotal Amount (INR)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="Enter subtotal"
          required
        />

        <label>Discount Amount (INR)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={discount}
          onChange={(event) => setDiscount(event.target.value)}
        />

        <label>Additional Charges (INR)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={charges}
          onChange={(event) => setCharges(event.target.value)}
        />

        <label>Tax Amount (INR)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={tax}
          onChange={(event) => setTax(event.target.value)}
        />

        <div className="billing-total-preview">
          Calculated Final Total: INR{" "}
          {(
            Number(amount || 0) +
            Number(charges || 0) +
            Number(tax || 0) -
            Number(discount || 0)
          ).toFixed(2)}
        </div>

        <label>Payment Method</label>
        <select
          value={method}
          onChange={(event) => setMethod(event.target.value)}
        >
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
          <option value="card">Card</option>
          <option value="online">Online</option>
        </select>

        <label>Payment Status</label>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
        </select>

        <button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Create Bill"}
        </button>
      </form>

      {editingBillId !== null && (
        <form className="billing-form billing-edit-form" onSubmit={saveEditedBill}>
          <h3>Edit Bill #{editingBillId}</h3>

          <label>Customer</label>
          <select
            value={editCustomerId}
            onChange={(event) => {
              setEditCustomerId(event.target.value);
              setEditAppointmentId("");
            }}
            required
          >
            <option value="">Select Customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.full_name || customer.name}
              </option>
            ))}
          </select>

          <label>Appointment (Optional)</label>
          <select
            value={editAppointmentId}
            onChange={(event) => setEditAppointmentId(event.target.value)}
          >
            <option value="">No Appointment Selected</option>
            {editSelectedAppointments.map((appointment) => (
              <option key={appointment.id} value={appointment.id}>
                {appointment.service_name || appointment.service || "Appointment"} — {appointment.appointment_date || ""}
              </option>
            ))}
          </select>

          <label>Subtotal Amount (INR)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={editAmount}
            onChange={(event) => setEditAmount(event.target.value)}
            placeholder="Enter subtotal"
            required
          />

          <label>Discount Amount (INR)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={editDiscount}
            onChange={(event) => setEditDiscount(event.target.value)}
          />

          <label>Additional Charges (INR)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={editCharges}
            onChange={(event) => setEditCharges(event.target.value)}
          />

          <label>Tax Amount (INR)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={editTax}
            onChange={(event) => setEditTax(event.target.value)}
          />

          <div className="billing-total-preview">
            Calculated Final Total: INR{" "}
            {(
              Number(editAmount || 0) +
              Number(editCharges || 0) +
              Number(editTax || 0) -
              Number(editDiscount || 0)
            ).toFixed(2)}
          </div>

          <label>Payment Method</label>
          <select value={editMethod} onChange={(event) => setEditMethod(event.target.value)}>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="online">Online</option>
          </select>

          <label>Payment Status</label>
          <select value={editStatus} onChange={(event) => setEditStatus(event.target.value)}>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <div className="billing-edit-actions">
            <button type="submit" disabled={editLoading}>
              {editLoading ? "Saving..." : "Save Changes"}
            </button>
            <button type="button" className="billing-delete" onClick={cancelEditBill} disabled={editLoading}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="billing-table-section">
        <h3>Payment Records</h3>

        <div className="billing-table-wrap">
          <table className="billing-table">
            <thead>
              <tr>
                <th>Bill ID</th>
                <th>Customer</th>
                <th>Service</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {bills.map((bill) => (
                <tr key={bill.id}>
                  <td>#{bill.id}</td>
                  <td>{bill.customer_name}</td>
                  <td>{bill.service_name || "—"}</td>
                  <td>
                    ₹{Number(bill.total_amount || 0).toLocaleString("en-IN")}
                  </td>
                  <td>
                    {String(bill.payment_method || "").toUpperCase()}
                  </td>
                  <td>
                    <span
                      className={`billing-status ${bill.payment_status}`}
                    >
                      {bill.payment_status}
                    </span>
                  </td>
                  <td>{bill.created_at}</td>
                  <td className="billing-actions">
                    <button
                      type="button"
                      onClick={() => startEditBill(bill)}
                    >
                      Edit
                    </button>
                    {bill.payment_status === "pending" && (
                      <button
                        type="button"
                        onClick={() => updateStatus(bill.id, "paid")}
                      >
                        Mark Paid
                      </button>
                    )}

                    <button
                      type="button"
                      className="billing-delete"
                      onClick={() => deleteBill(bill.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {bills.length === 0 && (
                <tr>
                  <td colSpan="8" className="billing-empty">
                    No bills found. Create your first bill.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Billing;
