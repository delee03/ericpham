import { redirect } from "next/navigation";

// Temporary: the zoom-out journey replaces this redirect when its shell lands.
export default function Home() {
    redirect("/plain");
}
