import Link from "next/link";
export default function NotFound() {
  return (
    <div className="card mx-auto mt-6 max-w-lg p-10 text-center">
      <p className="text-6xl font-bold heading-gradient">404</p>
      <h1 className="mt-2 text-xl font-bold">This page slipped off the magnet</h1>
      <p className="mt-1 text-muted">The link may be old or mistyped.</p>
      <Link href="/shop" className="btn btn-primary mt-6">Shop cases</Link>
    </div>
  );
}
