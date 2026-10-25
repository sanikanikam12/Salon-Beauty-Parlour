import { useEffect, useState } from "react";
import "./StaffScheduling.css";

const API = `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/api/salon/`;
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function todayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function StaffScheduling() {
  const [staff, setStaff] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [scheduleDate, setScheduleDate] = useState(todayLocal());
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [scheduleError, setScheduleError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    setScheduleError("");

    try {
      const response = await fetch(`${API}staff/`);
      const data = await response.json();

      if (!response.ok || !Array.isArray(data)) {
        throw new Error(data.error || "Staff list load zali nahi.");
      }

      setStaff(data.map((person) => ({
        ...person,
        working_days: String(person.working_days || "")
          .split(",")
          .map((day) => day.trim())
          .filter(Boolean),
        start_time: person.start_time || "",
        end_time: person.end_time || "",
        specializations: person.specializations || "",
      })));
    } catch (err) {
      setError(err.message || "Staff load kartana error aala.");
    }

    try {
      const response = await fetch(`${API}appointments/`);
      const data = await response.json();

      if (!response.ok || !Array.isArray(data)) {
        throw new Error(data.error || "Appointment schedule load zala nahi.");
      }

      setAppointments(data);
    } catch (err) {
      setAppointments([]);
      setScheduleError(err.message || "Appointment schedule load zala nahi.");
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function updateStaff(id, field, value) {
    setStaff((current) =>
      current.map((person) =>
        person.id === id ? { ...person, [field]: value } : person
      )
    );
    setSuccess("");
  }

  function toggleDay(person, day) {
    const currentDays = person.working_days || [];
    const nextDays = currentDays.includes(day)
      ? currentDays.filter((item) => item !== day)
      : DAYS.filter((item) => currentDays.includes(item) || item === day);

    updateStaff(person.id, "working_days", nextDays);
  }

  async function saveStaff(person) {
    setSavingId(person.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API}staff/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: person.id,
          full_name: person.full_name,
          email: person.email,
          phone: person.phone,
          role: person.role,
          specializations: person.specializations || "",
          working_days: (person.working_days || []).join(", "),
          start_time: person.start_time || "",
          end_time: person.end_time || "",
          is_active: person.is_active,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Schedule save zala nahi.");
      }

      setSuccess(`${person.full_name} cha schedule save zala.`);
      await loadData();
    } catch (err) {
      setError(err.message || "Schedule save kartana error aala.");
    } finally {
      setSavingId(null);
    }
  }

  function appointmentStaffId(item) {
    return item.staff_id ?? item.staff?.id ?? item.staff;
  }

  function appointmentTime(item) {
    return item.appointment_time || item.time || "";
  }

  function appointmentStaffName(item) {
    const id = appointmentStaffId(item);
    const found = staff.find((person) => Number(person.id) === Number(id));

    return item.staff_name ||
      item.staff_full_name ||
      item.staff?.full_name ||
      found?.full_name ||
      "Staff not assigned";
  }

  const todaysAppointments = appointments
    .filter((item) => {
      const date = String(item.appointment_date || item.date || "").slice(0, 10);
      return date === scheduleDate && item.status !== "cancelled";
    })
    .sort((a, b) => appointmentTime(a).localeCompare(appointmentTime(b)));

  if (loading) {
    return <section className="staff-scheduling"><p>Loading staff schedule...</p></section>;
  }

  return (
    <section className="staff-scheduling">
      <div className="scheduling-heading">
        <div>
          <p className="scheduling-eyebrow">TEAM MANAGEMENT</p>
          <h2>Staff Scheduling</h2>
          <p>Working days, shift timings ani daily appointments manage kara.</p>
        </div>
        <button type="button" className="schedule-refresh" onClick={loadData}>
          Refresh
        </button>
      </div>

      {error && <p className="schedule-message schedule-error">{error}</p>}
      {success && <p className="schedule-message schedule-success">{success}</p>}

      {staff.length === 0 && !error && (
        <p className="schedule-message">Appointment staff list madhye staff records nahit.</p>
      )}

      <div className="schedule-staff-grid">
        {staff.map((person) => (
          <article className="schedule-staff-card" key={person.id}>
            <div className="schedule-person-heading">
              <div className="schedule-avatar">
                {(person.full_name || "S").trim().charAt(0).toUpperCase()}
              </div>
              <div>
                <h3>{person.full_name}</h3>
                <p>{person.role} · {person.phone}</p>
              </div>
            </div>

            <label className="schedule-label">Working Days</label>
            <div className="schedule-days">
              {DAYS.map((day) => (
                <label className="schedule-day" key={day}>
                  <input
                    type="checkbox"
                    checked={(person.working_days || []).includes(day)}
                    onChange={() => toggleDay(person, day)}
                  />
                  <span>{day.slice(0, 3)}</span>
                </label>
              ))}
            </div>

            <div className="schedule-time-fields">
              <div>
                <label className="schedule-label" htmlFor={`start-${person.id}`}>
                  Shift Start
                </label>
                <input
                  id={`start-${person.id}`}
                  type="time"
                  value={person.start_time}
                  onChange={(event) => updateStaff(person.id, "start_time", event.target.value)}
                />
              </div>
              <div>
                <label className="schedule-label" htmlFor={`end-${person.id}`}>
                  Shift End
                </label>
                <input
                  id={`end-${person.id}`}
                  type="time"
                  value={person.end_time}
                  onChange={(event) => updateStaff(person.id, "end_time", event.target.value)}
                />
              </div>
            </div>

            <label className="schedule-label" htmlFor={`services-${person.id}`}>
              Specializations / Assigned Services
            </label>
            <textarea
              id={`services-${person.id}`}
              value={person.specializations}
              onChange={(event) => updateStaff(person.id, "specializations", event.target.value)}
              placeholder="Hair Cut, Facial, Hair Treatment..."
              rows={2}
            />

            <button
              type="button"
              className="schedule-save"
              disabled={savingId === person.id}
              onClick={() => saveStaff(person)}
            >
              {savingId === person.id ? "Saving..." : "Save Schedule"}
            </button>
          </article>
        ))}
      </div>

      <section className="daily-schedule">
        <div className="daily-schedule-heading">
          <div>
            <h2>Daily Appointment Schedule</h2>
            <p>{todaysAppointments.length} appointment(s) for selected date</p>
          </div>
          <input
            aria-label="Select schedule date"
            type="date"
            value={scheduleDate}
            onChange={(event) => setScheduleDate(event.target.value)}
          />
        </div>

        {scheduleError && (
          <p className="schedule-message schedule-error">{scheduleError}</p>
        )}

        {!scheduleError && todaysAppointments.length === 0 && (
          <p className="schedule-empty">Ya date sathi appointments sapadlya nahit.</p>
        )}

        {!scheduleError && todaysAppointments.length > 0 && (
          <div className="schedule-table-wrap">
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Staff</th>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {todaysAppointments.map((item, index) => (
                  <tr key={item.id ?? `${scheduleDate}-${index}`}>
                    <td>{appointmentTime(item) || "—"}</td>
                    <td>{appointmentStaffName(item)}</td>
                    <td>{item.customer_name || item.customer?.full_name || item.customer_full_name || "—"}</td>
                    <td>{item.service_name || item.service?.name || item.service_title || "—"}</td>
                    <td><span className={`schedule-status status-${item.status || "pending"}`}>{item.status || "pending"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

export default StaffScheduling;
