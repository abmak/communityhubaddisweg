import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Compass, Coffee, Home, Search } from "lucide-react";

export function NotFound() {
  useEffect(() => {
    const previous = document.title;
    document.title = "Page not found · አዲስ ገበታ";
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center py-10 text-center">
      <div className="relative mb-6">
        <span className="font-display text-[96px] font-semibold leading-none tracking-tighter text-brand-800/10 dark:text-brand-200/10">
          404
        </span>
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-800 text-white shadow-lift">
            <Coffee className="h-8 w-8" />
          </span>
        </span>
      </div>
      <h1 className="font-display text-2xl font-semibold text-ink">This table isn't set.</h1>
      <p lang="am" className="mt-1 font-ethiopic text-sm text-brand-700 dark:text-brand-300">
        ይህ ገጽ አልተገኘም
      </p>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted">
        The page you were looking for may have moved, or the conversation may have ended. There's
        plenty more happening in the community.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link to="/home" className="btn-primary">
          <Home className="h-4 w-4" /> Back to the feed
        </Link>
        <Link to="/explore" className="btn-secondary">
          <Compass className="h-4 w-4" /> Explore
        </Link>
        <Link to="/search" className="btn-secondary">
          <Search className="h-4 w-4" /> Search
        </Link>
      </div>
    </div>
  );
}
