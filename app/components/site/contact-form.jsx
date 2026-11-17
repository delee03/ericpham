"use client";

import { isValidEmail } from "@/utils/check-email";
import { useState } from "react";
import Turnstile from "./turnstile";

// Cloudflare Turnstile site key (public by design). The matching secret lives
// in TURNSTILE_SECRET_KEY on the host; the server only enforces the check when
// that is set.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "0x4AAAAAAGE57sAJB1Q-04vh";

const EMPTY = { name: "", email: "", message: "", company: "" };

const fieldClass =
    "w-full rounded-[10px] border border-line bg-field px-3 text-[15px] text-ink outline-none transition-colors focus:border-sky";

// Contact form shared by the journey's last level and the plain page.
// States: idle, sending, sent, plus inline validation and server errors.
export default function ContactForm() {
    const [values, setValues] = useState(EMPTY);
    const [status, setStatus] = useState("idle"); // idle | sending | sent
    const [error, setError] = useState("");
    // The widget loads on first focus, so the third-party script stays off the
    // page until someone starts writing. `attempt` remounts it for a new token.
    const [armed, setArmed] = useState(false);
    const [token, setToken] = useState("");
    const [attempt, setAttempt] = useState(0);
    // Set when the widget cannot run here (e.g. localhost or a preview domain);
    // the form then sends without a token and the server decides.
    const [widgetFailed, setWidgetFailed] = useState(false);

    const set = (key) => (e) => {
        setValues((v) => ({ ...v, [key]: e.target.value }));
        if (error) setError("");
    };

    const submit = async (e) => {
        e.preventDefault();
        const name = values.name.trim();
        const email = values.email.trim();
        const message = values.message.trim();
        if (!name || !email || !message) {
            setError("Please fill in your name, email and message.");
            return;
        }
        if (!isValidEmail(email)) {
            setError("Please enter a valid email address.");
            return;
        }
        if (!token && !widgetFailed) {
            setArmed(true);
            setError("Please wait for the verification check to finish, then send again.");
            return;
        }

        setStatus("sending");
        try {
            const res = await fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...values, name, email, message, "cf-turnstile-response": token }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                throw new Error(data.message || "Something went wrong. Please try again later.");
            }
            setValues(EMPTY);
            setStatus("sent");
        } catch (err) {
            setError(err.message || "Something went wrong. Please try again later.");
            setStatus("idle");
        } finally {
            // Tokens are single use: get a fresh one for the next send.
            setToken("");
            setAttempt((n) => n + 1);
        }
    };

    if (status === "sent") {
        return (
            <div className="flex flex-col gap-2 py-5" role="status">
                <p className="font-mono text-[13px] tracking-wider text-sky">TRANSMISSION SENT</p>
                <p className="text-[17px] text-ink">
                    Your message is on its way. I&apos;ll reply within a few days.
                </p>
                <button
                    type="button"
                    onClick={() => setStatus("idle")}
                    className="mt-2 min-h-[44px] self-start text-sm text-muted underline underline-offset-4 hover:text-ink"
                >
                    Send another message
                </button>
            </div>
        );
    }

    const sending = status === "sending";

    return (
        <form onSubmit={submit} onFocus={() => setArmed(true)} noValidate className="flex flex-col gap-3.5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-[13px] text-muted">
                    Your name
                    <input
                        type="text"
                        name="name"
                        autoComplete="name"
                        maxLength={100}
                        required
                        value={values.name}
                        onChange={set("name")}
                        className={`${fieldClass} h-11`}
                    />
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] text-muted">
                    Your email
                    <input
                        type="email"
                        name="email"
                        autoComplete="email"
                        maxLength={100}
                        required
                        value={values.email}
                        onChange={set("email")}
                        className={`${fieldClass} h-11`}
                    />
                </label>
            </div>
            <label className="flex flex-col gap-1.5 text-[13px] text-muted">
                Message
                <textarea
                    name="message"
                    rows={3}
                    maxLength={2000}
                    required
                    value={values.message}
                    onChange={set("message")}
                    className={`${fieldClass} resize-none py-2.5`}
                />
            </label>
            {/* Honeypot: hidden from people, filled by bots. */}
            <input
                type="text"
                name="company"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={values.company}
                onChange={set("company")}
                className="absolute -left-[9999px] h-px w-px opacity-0"
            />
            {armed && !widgetFailed && (
                <Turnstile
                    key={attempt}
                    siteKey={TURNSTILE_SITE_KEY}
                    action="contact"
                    onToken={setToken}
                    onError={() => setWidgetFailed(true)}
                />
            )}
            {error && (
                <p role="alert" className="text-sm text-[#FF9E9E]">
                    {error}
                </p>
            )}
            <button
                type="submit"
                disabled={sending}
                className="h-12 rounded-full bg-gold text-[15px] font-semibold text-[#1A1206] transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
            >
                {sending ? "Transmitting…" : "Send transmission"}
            </button>
        </form>
    );
}
