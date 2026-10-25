import React, { useCallback, useEffect, useState } from "react";
import "./Notifications.css";

const API = `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/api/salon/notifications/`;

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(API);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Notifications load zhalya nahit.");
      }

      setNotifications(
        Array.isArray(data.notifications) ? data.notifications : []
      );
      setUnreadCount(Number(data.unread_count || 0));
    } catch (err) {
      setError(
        err.message || "Backend connection check karun punha prayatna kar."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  async function markAsRead(id) {
    setBusyId(id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API}${id}/read/`, {
        method: "PATCH",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Notification update zali nahi.");
      }

      setSuccess("Notification read mark keli.");
      await loadNotifications();
    } catch (err) {
      setError(err.message || "Notification update zali nahi.");
    } finally {
      setBusyId(null);
    }
  }

  async function markAllAsRead() {
    setBusyId("all");
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API}read-all/`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Notifications update zhalya nahit.");
      }

      setSuccess(
        `${Number(data.updated_count || 0)} notification(s) read mark kelya.`
      );
      await loadNotifications();
    } catch (err) {
      setError(err.message || "Notifications update zhalya nahit.");
    } finally {
      setBusyId(null);
    }
  }

  function notificationIcon(type) {
    if (type === "appointment") return "📅";
    if (type === "payment") return "💳";
    if (type === "membership") return "🎁";
    return "🔔";
  }

  function formatDate(value) {
    if (!value) return "Date unavailable";

    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        });
  }

  return (
    <section className="notifications-page">
      <div className="notifications-heading">
        <div>
          <h1>Notifications</h1>
          <p>Glow Beauty Salon — Updates and Alerts</p>
        </div>

        <div className="notifications-heading-actions">
          <span className="notifications-unread-count">
            {unreadCount} unread
          </span>

          <button
            type="button"
            className="notification-secondary-button"
            onClick={loadNotifications}
            disabled={loading}
          >
            ↻ Refresh
          </button>

          <button
            type="button"
            className="notification-primary-button"
            onClick={markAllAsRead}
            disabled={loading || unreadCount === 0 || busyId !== null}
          >
            {busyId === "all" ? "Updating..." : "Mark all as read"}
          </button>
        </div>
      </div>

      {error && (
        <p className="notifications-message notifications-error" role="alert">
          {error}
        </p>
      )}

      {success && (
        <p className="notifications-message notifications-success" role="status">
          {success}
        </p>
      )}

      {loading ? (
        <div className="notifications-empty">Loading notifications...</div>
      ) : notifications.length === 0 ? (
        <div className="notifications-empty">
          <span>🔔</span>
          <h3>No Notifications Yet</h3>
          <p>New appointment and payment updates will appear here.</p>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map((item) => (
            <article
              key={item.id}
              className={`notification-card ${
                item.is_read ? "notification-read" : "notification-unread"
              }`}
            >
              <div className="notification-icon">
                {notificationIcon(item.notification_type)}
              </div>

              <div className="notification-content">
                <div className="notification-title-row">
                  <h3>{item.title}</h3>
                  {!item.is_read && (
                    <span className="notification-new-label">New</span>
                  )}
                </div>

                <p>{item.message}</p>
                <small>{formatDate(item.created_at)}</small>
              </div>

              <div className="notification-actions">
                {item.is_read ? (
                  <span className="notification-read-label">✓ Read</span>
                ) : (
                  <button
                    type="button"
                    className="notification-read-button"
                    disabled={busyId !== null}
                    onClick={() => markAsRead(item.id)}
                  >
                    {busyId === item.id ? "Saving..." : "Mark as read"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default Notifications;
