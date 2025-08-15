export default function Footer() {
  return (
    <footer className="border-t py-6 text-center text-sm text-gray-600">
      <div className="container-page">
        © {new Date().getFullYear()} MyReactApp. All rights reserved.
      </div>
    </footer>
  );
}
