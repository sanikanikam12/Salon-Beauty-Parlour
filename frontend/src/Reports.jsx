import React, { useCallback, useEffect, useState } from "react";
import "./Reports.css";

const API_URL = `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/api/salon/reports/`;

function formatDate(value) {
  if (!value) return "—";
  const parts = String(value).split("-");
  return parts.length === 3
    ? `${parts[2]}/${parts[1]}/${parts[0]}`
    : value;
}

function Reports() {
  const [report, setReport] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const money = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));

  const loadReports = useCallback(async (fromDate = "", toDate = "") => {
    setLoading(true);
    setError("");

    try {
      const url = new URL(API_URL);

      if (fromDate) url.searchParams.set("start_date", fromDate);
      if (toDate) url.searchParams.set("end_date", toDate);

      const response = await fetch(url.toString());
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Reports load karta ale nahit.");
      }

      setReport(data);
    } catch (err) {
      setError(
        err.message ||
          "Reports load hot nahiyet. Django server chalu aahe ka te check kar."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports("", "");
  }, [loadReports]);

  const handleGenerate = (event) => {
    event.preventDefault();

    if (startDate && endDate && startDate > endDate) {
      setError("Start date hi end date chya adhi asayla havi.");
      return;
    }

    loadReports(startDate, endDate);
  };

  const summary = report?.summary || {};
  const bills = report?.billing_summary || [];
  const dailySales = report?.daily_sales || [];
  const popularServices = report?.service_popularity || [];
  const staffBookings = report?.staff_bookings || [];
  const appointments = report?.appointments || [];
  const outstandingPayments = report?.outstanding_payments || [];

  const maxDailySales = Math.max(
    1,
    ...dailySales.map((item) => Number(item.collected_amount || 0))
  );

  return (
    <div className="reports-page">
      <h1>Reports &amp; Analytics</h1>
      <p className="reports-subtitle">
        Glow Beauty Salon — Business Overview
      </p>

      <form className="reports-filter" onSubmit={handleGenerate}>
        <div className="reports-filter-field">
          <label htmlFor="report-start-date">From Date</label>
          <input
            id="report-start-date"
            type="date"
            value={startDate}
            max={endDate || undefined}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </div>

        <div className="reports-filter-field">
          <label htmlFor="report-end-date">To Date</label>
          <input
            id="report-end-date"
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </div>

        <button className="reports-generate-button" type="submit" disabled={loading}>
          {loading ? "Loading..." : "Generate Report"}
        </button>

        <button
          className="reports-reset-button"
          type="button"
          disabled={loading && !report}
          onClick={() => {
            setStartDate("");
            setEndDate("");
            loadReports("", "");
          }}
        >
          Show All Dates
        </button>
      </form>

      {error && (
        <div className="reports-error" role="alert">
          {error}
        </div>
      )}

      {loading && !report && <p>Reports load hot aahet...</p>}

      {report && (
        <>
          <div className="reports-grid">
            <div className="report-card">
              <span>👥</span>
              <h3>Total Customers</h3>
              <h2>{summary.total_customers ?? 0}</h2>
            </div>

            <div className="report-card">
              <span>📅</span>
              <h3>Total Appointments</h3>
              <h2>{summary.total_appointments ?? 0}</h2>
            </div>

            <div className="report-card">
              <span>💰</span>
              <h3>Collected Revenue</h3>
              <h2>{money(summary.total_revenue)}</h2>
              <small>Paid bills madhun milalele paise</small>
            </div>

            <div className="report-card">
              <span>✅</span>
              <h3>Paid Bills</h3>
              <h2>{summary.paid_bills ?? 0}</h2>
            </div>

            <div className="report-card">
              <span>🧾</span>
              <h3>Total Bills</h3>
              <h2>{summary.total_bills ?? 0}</h2>
            </div>

            <div className="report-card">
              <span>⏳</span>
              <h3>Pending Amount</h3>
              <h2>{money(summary.pending_amount)}</h2>
            </div>
          </div>

          <div className="report-table-container reports-section">
            <h2>Daily Sales Report</h2>
            <p className="reports-section-subtitle">
              Darroj collect zalele payment ani paid bills chi sankhya.
            </p>

            {dailySales.length ? (
              <div className="reports-sales-list">
                {dailySales.map((item) => (
                  <div className="reports-sales-row" key={item.date}>
                    <div className="reports-sales-info">
                      <strong>{formatDate(item.date)}</strong>
                      <span>{item.bills_count} paid bill(s)</span>
                      <strong>{money(item.collected_amount)}</strong>
                    </div>
                    <div
                      className="reports-sales-bar"
                      role="progressbar"
                      aria-label={`Sales on ${item.date}`}
                      aria-valuemin="0"
                      aria-valuemax={maxDailySales}
                      aria-valuenow={Number(item.collected_amount || 0)}
                    >
                      <div
                        className="reports-sales-bar-fill"
                        style={{
                          width: `${Math.min(
                            100,
                            (Number(item.collected_amount || 0) /
                              maxDailySales) *
                              100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="reports-empty">Ya date range madhye paid sales nahi.</p>
            )}
          </div>

          <div className="reports-sections-grid">
            <div className="report-table-container reports-section">
              <h2>Service Popularity</h2>
              <p className="reports-section-subtitle">
                Kontya service chya bookings jast aahet.
              </p>

              <table className="report-table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Bookings</th>
                  </tr>
                </thead>
                <tbody>
                  {popularServices.length ? (
                    popularServices.map((item) => (
                      <tr key={item.service_name}>
                        <td>{item.service_name}</td>
                        <td>{item.bookings}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="2">Service bookings available nahiyet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="report-table-container reports-section">
              <h2>Staff Bookings</h2>
              <p className="reports-section-subtitle">
                Staff nusar appointment ani status count.
              </p>

              <table className="report-table">
                <thead>
                  <tr>
                    <th>Staff</th>
                    <th>Total</th>
                    <th>Pending</th>
                    <th>Confirmed</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {staffBookings.length ? (
                    staffBookings.map((item) => (
                      <tr key={item.staff_name}>
                        <td>{item.staff_name}</td>
                        <td>{item.bookings}</td>
                        <td>{item.pending}</td>
                        <td>{item.confirmed}</td>
                        <td>{item.completed}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5">Staff booking data available nahi.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="report-table-container reports-section">
            <h2>Appointments Report</h2>
            <p className="reports-section-subtitle">
              Selected date range madhil appointments.
            </p>

            <table className="report-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Staff</th>
                  <th>Status</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                {appointments.length ? (
                  appointments.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.date)}</td>
                      <td>{item.time}</td>
                      <td>{item.customer_name}</td>
                      <td>{item.service_name}</td>
                      <td>{item.staff_name || "Not assigned"}</td>
                      <td>
                        <span className={`reports-status status-${item.status}`}>
                          {item.status}
                        </span>
                      </td>
                      <td>{money(item.price)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7">Ya date range madhye appointments nahiyet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="report-table-container reports-section">
            <h2>Billing Summary</h2>

            <table className="report-table">
              <thead>
                <tr>
                  <th>Bill ID</th>
                  <th>Amount</th>
                  <th>Payment Method</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bills.length ? (
                  [...bills]
                    .sort((x, y) => Number(x.id) - Number(y.id))
                    .map((bill) => (
                      <tr key={bill.id}>
                        <td>#{bill.id}</td>
                        <td>{money(bill.amount)}</td>
                        <td>{bill.payment_method || "—"}</td>
                        <td>
                          <span className={`reports-status status-${bill.status}`}>
                            {bill.status}
                          </span>
                        </td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td colSpan="4">No billing records available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="report-table-container reports-section">
            <h2>Outstanding Payments</h2>
            <p className="reports-section-subtitle">
              Fakt pending bills ani tyanchi baki rakkam.
            </p>

            <table className="report-table">
              <thead>
                <tr>
                  <th>Bill ID</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Payment Method</th>
                  <th>Pending Amount</th>
                </tr>
              </thead>
              <tbody>
                {outstandingPayments.length ? (
                  outstandingPayments.map((item) => (
                    <tr key={item.bill_id}>
                      <td>#{item.bill_id}</td>
                      <td>{item.customer_name}</td>
                      <td>{item.date}</td>
                      <td>{item.payment_method || "—"}</td>
                      <td>{money(item.amount)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5">Pending payments nahiyet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default Reports;
