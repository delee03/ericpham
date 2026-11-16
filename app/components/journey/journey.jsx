"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { personalData } from "@/utils/data/personal-data";
import Header from "./hud/header";
import { Controls, Readout, ScaleBar } from "./hud/hud";
import { engine } from "./journey-engine";
import Drawer from "./overlays/drawer";
import { AboutMore, EducationMore, ProjectsMore, WritingMore } from "./overlays/more-content";
import Overlays from "./overlays/overlays";
import { preloadAround } from "./scenes";

// The WebGL stage is client-only and loaded after the content has rendered.
const Stage = dynamic(() => import("./stage"), { ssr: false });

const DRAWERS = {
    about: { title: `About ${personalData.name}`, Body: AboutMore },
    projects: { title: "All projects", Body: ProjectsMore },
    education: { title: "Education and certificates", Body: EducationMore },
    writing: { title: "Transmissions", Body: WritingMore },
};

function hasWebGL() {
    try {
        const c = document.createElement("canvas");
        return !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
        return false;
    }
}

// Client shell of the zoom-out journey. All content overlays are server
// rendered (SEO); the engine and the canvas only start after the capability
// check, and visitors who prefer reduced motion or lack WebGL go to /plain.
export default function Journey({ blogs = [] }) {
    const router = useRouter();
    const spacerRef = useRef(null);
    const [ready, setReady] = useState(false);
    const [drawer, setDrawer] = useState(null);

    useEffect(() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce || !hasWebGL()) {
            router.replace("/plain");
            return undefined;
        }
        const root = document.documentElement;
        const touch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
        root.classList.add("journey-root");
        root.classList.toggle("journey-touch", touch);
        engine.mount({ touch, spacer: spacerRef.current });
        preloadAround(0);
        setReady(true);
        return () => {
            engine.unmount();
            root.classList.remove("journey-root", "journey-touch");
            setReady(false);
        };
    }, [router]);

    const close = useCallback(() => setDrawer(null), []);

    return (
        <>
            {/* Scroll space: its height is set by the engine (730svh until then). */}
            <div ref={spacerRef} aria-hidden="true" style={{ height: "730svh" }} />
            <div className="fixed inset-0 overflow-hidden bg-void">
                {ready && <Stage />}
                <Overlays blogs={blogs} openDrawer={setDrawer} />
                <Header />
                <ScaleBar />
                <Readout />
                <Controls />
            </div>
            {Object.entries(DRAWERS).map(([key, { title, Body }]) => (
                <Drawer key={key} open={drawer === key} onClose={close} title={title}>
                    <Body blogs={blogs} />
                </Drawer>
            ))}
            <noscript>
                <p style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 60, padding: 16, background: "#05060A", textAlign: "center" }}>
                    <a href="/plain" style={{ color: "#8EC5FF" }}>
                        JavaScript is off: open the plain version of this site
                    </a>
                </p>
            </noscript>
        </>
    );
}
