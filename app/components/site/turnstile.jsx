"use client";

import { useEffect, useRef } from "react";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise;

function loadTurnstile() {
    if (window.turnstile) return Promise.resolve();
    if (!scriptPromise) {
        scriptPromise = new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = SCRIPT_SRC;
            s.async = true;
            s.onload = resolve;
            s.onerror = () => {
                scriptPromise = undefined;
                reject(new Error("Turnstile failed to load"));
            };
            document.head.appendChild(s);
        });
    }
    return scriptPromise;
}

// Cloudflare Turnstile widget. Calls `onToken` with a token once the visitor
// is verified and with "" when it expires, and `onError` when the widget
// cannot run (script blocked, or a hostname the widget is not set up for).
// Remount it (change its `key`) to get a fresh token: tokens are single use.
export default function Turnstile({ siteKey, action, onToken, onError }) {
    const boxRef = useRef(null);
    const onTokenRef = useRef(onToken);
    const onErrorRef = useRef(onError);
    onTokenRef.current = onToken;
    onErrorRef.current = onError;

    useEffect(() => {
        let widgetId;
        let cancelled = false;
        loadTurnstile()
            .then(() => {
                if (cancelled || !boxRef.current) return;
                widgetId = window.turnstile.render(boxRef.current, {
                    sitekey: siteKey,
                    action,
                    theme: "dark",
                    size: "flexible",
                    callback: (token) => onTokenRef.current(token),
                    "expired-callback": () => onTokenRef.current(""),
                    "error-callback": () => {
                        onErrorRef.current?.();
                        return true; // handled: keep it out of the console
                    },
                });
            })
            .catch(() => onErrorRef.current?.());
        return () => {
            cancelled = true;
            if (widgetId !== undefined && window.turnstile) window.turnstile.remove(widgetId);
        };
    }, [siteKey, action]);

    return <div ref={boxRef} className="min-h-[65px]" />;
}
