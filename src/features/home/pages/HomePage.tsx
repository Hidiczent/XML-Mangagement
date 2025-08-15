import UploadXml from "@/components/common/UploadXml";
import useTitle from "@/hooks/useTitle";

export default function HomePage() {
  useTitle("Home");
  return (
    <section className="space-y-6">
      <UploadXml />
    </section>
  );
}
