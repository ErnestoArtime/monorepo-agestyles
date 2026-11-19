import { useCallback } from "react";
import { HomeEditor, type HomeContent, type HomeEditorData } from "../components/home-editor";
import { useBusiness } from "../context/business-context";

/**
 * «Portada de mi tienda» (AG-34): carousel and featured products of this store's own page in
 * Tienda. The server only lets the owner or the store's administration change it, and only
 * with this store's products.
 */
export default function StoreHomeScreen() {
  const { request, upload, seller } = useBusiness();
  const load = useCallback(
    () => request<HomeEditorData>("/vendor/agestyles/store-home"),
    // The selected store changes what the server returns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [request, seller?.id],
  );
  const save = useCallback(
    async (content: HomeContent) =>
      (await request<{ content: HomeContent }>("/vendor/agestyles/store-home", "POST", content))
        .content,
    [request],
  );
  return (
    <HomeEditor
      title="Portada de mi tienda"
      subtitle="Carrusel y productos destacados de la página de tu tienda en la Tienda."
      emptyBanners="Sin banners, tu página muestra la portada y el logo de la tienda."
      featuredHelp="Salen en la fila «Destacados» de tu página, encima de tus productos. Solo puedes destacar productos de tu tienda; los que no tengan existencias se ocultan solos."
      savedNotice="Portada guardada. Tu página la muestra en menos de un minuto."
      linkKinds={["none", "category", "product", "url"]}
      load={load}
      save={save}
      upload={upload}
    />
  );
}
