import { useCallback } from "react";
import { HomeEditor, type HomeContent, type Named } from "../../components/home-editor";
import { useAdmin } from "../../context/admin-context";

/** «Portada de la Tienda» (AG-34): the marketplace home, managed by the administration. */
export default function AdminHomeScreen() {
  const { adminRequest, adminUpload } = useAdmin();
  const load = useCallback(async () => {
    const [home, stores] = await Promise.all([
      adminRequest<{
        content: HomeContent;
        products: { id: string; title: string; thumbnail: string | null }[];
        categories: Named[];
      }>("/admin/agestyles/home"),
      adminRequest<{ sellers: Named[] }>("/admin/sellers?limit=200&fields=id,name").catch(() => ({
        sellers: [] as Named[],
      })),
    ]);
    return { ...home, sellers: stores.sellers ?? [] };
  }, [adminRequest]);
  const save = useCallback(
    async (content: HomeContent) =>
      (await adminRequest<{ content: HomeContent }>("/admin/agestyles/home", "POST", content))
        .content,
    [adminRequest],
  );
  return (
    <HomeEditor
      title="Portada de la Tienda"
      subtitle="Carrusel y productos destacados de la página inicial de toda la Tienda."
      emptyBanners="Sin banners, la Tienda muestra su presentación habitual."
      featuredHelp="Salen en la fila «Destacados» de la página inicial y primero en el catálogo. Los que no tengan existencias se ocultan solos."
      savedNotice="Portada guardada. La Tienda la muestra en menos de un minuto."
      linkKinds={["none", "category", "product", "seller", "url"]}
      load={load}
      save={save}
      upload={adminUpload}
    />
  );
}
