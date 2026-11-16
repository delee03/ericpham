import Journey from "./components/journey/journey";
import { getBlogs } from "@/utils/blog";

// Server component: fetch dev.to articles once (cached), render the journey shell.
export default async function Home() {
    const { blogs } = await getBlogs();
    return <Journey blogs={blogs.slice(0, 3).map(({ id, title, url }) => ({ id, title, url }))} />;
}
