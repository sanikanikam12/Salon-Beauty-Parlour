
import { useEffect, useState } from "react";
import "./Staff.css";

const API = "http://127.0.0.1:8000/api/staff/";

function Staff() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const emptyForm = {
    name: "",
    phone: "",
    role: "Beautician",
    salary: "",
    workingHours: "",
  };

  const [form, setForm] = useState(emptyForm);

  // Load staff from Django database
  async function loadStaff() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(API);

      if (!response.ok) {
        throw new Error("Staff information load झाली नाही.");
      }

      const data = await response.json();
      setStaff(data);
    } catch (err) {
      setError(
        "Backend चालू आहे का ते तपासा. " + err.message
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStaff();
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  // Add or update staff in database
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const url =
      editingId !== null ? `${API}${editingId}/` : API;

    const method = editingId !== null ? "PUT" : "POST";

    const payload = {
      ...form,
      salary: form.salary,
    };

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Staff save करता आला नाही."
        );
      }

      resetForm();
      await loadStaff();
    } catch (err) {
      setError(
        "Staff save झाला नाही. " + err.message
      );
    } finally {
      setSaving(false);
    }
  }

  // Edit staff
  function handleEdit(person) {
    setForm({
      name: person.name,
      phone: person.phone,
      role: person.role,
      salary: person.salary,
      workingHours: person.workingHours,
    });

    setEditingId(person.id);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // Delete staff from database
  async function handleDelete(id) {
    const confirmed = window.confirm(
      "Ha staff delete karaycha aahe ka?"
    );

    if (!confirmed) return;

    setError("");

    try {
      const response = await fetch(`${API}${id}/`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Staff delete झाला नाही."
        );
      }

      if (editingId === id) {
        resetForm();
      }

      await loadStaff();
    } catch (err) {
      setError("Delete करताना error: " + err.message);
    }
  }

  return (
    <div className="staff-page">
      <div className="staff-heading">
        <div>
          <h2>Staff Management</h2>
          <p>Manage your salon team</p>
        </div>

        <span className="staff-count">
          Total Staff: {staff.length}
        </span>
      </div>

      {error && (
        <p
          role="alert"
          style={{
            color: "red",
            marginBottom: "15px",
          }}
        >
          {error}
        </p>
      )}

      <form className="staff-form" onSubmit={handleSubmit}>
        <h3>
          {editingId !== null
            ? "Edit Staff"
            : "Add New Staff"}
        </h3>

        <div className="staff-form-grid">
          <input
            name="name"
            placeholder="Full Name"
            value={form.name}
            onChange={handleChange}
            required
          />

          <input
            name="phone"
            placeholder="Phone Number"
            value={form.phone}
            onChange={handleChange}
            required
          />

          <select
            name="role"
            value={form.role}
            onChange={handleChange}
            required
          >
            <option>Beautician</option>
            <option>Hair Stylist</option>
            <option>Receptionist</option>
            <option>Manager</option>
          </select>

          <input
            name="salary"
            type="number"
            min="0"
            step="0.01"
            placeholder="Monthly Salary (₹)"
            value={form.salary}
            onChange={handleChange}
            required
          />

          <input
            name="workingHours"
            placeholder="Working Hours (e.g. 10 AM - 6 PM)"
            value={form.workingHours}
            onChange={handleChange}
            required
          />
        </div>

        <div className="staff-actions">
          <button
            type="submit"
            className="staff-save"
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : editingId !== null
                ? "Update Staff"
                : "+ Add Staff"}
          </button>

          {editingId !== null && (
            <button
              type="button"
              className="staff-cancel"
              onClick={resetForm}
              disabled={saving}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="staff-table-wrapper">
        <table className="staff-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Position</th>
              <th>Salary</th>
              <th>Working Hours</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="staff-empty">
                  Loading staff...
                </td>
              </tr>
            ) : staff.length === 0 ? (
              <tr>
                <td colSpan="6" className="staff-empty">
                  No staff added yet.
                </td>
              </tr>
            ) : (
              staff.map((person) => (
                <tr key={person.id}>
                  <td>{person.name}</td>
                  <td>{person.phone}</td>
                  <td>{person.role}</td>
                  <td>₹{person.salary}</td>
                  <td>{person.workingHours}</td>
                  <td>
                    <button
                      type="button"
                      className="staff-edit"
                      onClick={() => handleEdit(person)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="staff-delete"
                      onClick={() => handleDelete(person.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Staff;
