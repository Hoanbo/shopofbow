import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import type { CatalogItem } from '../data/types';
import { fetchAllProducts } from '../data/api';
import { useToast } from '../components/Toast';

interface FavoritesContextValue {
  favoriteIds: Set<string>; // Product IDs and Product Slugs
  favoriteProducts: CatalogItem[];
  loadingFavorites: boolean;
  isFavorite: (productIdOrSlug: string) => boolean;
  toggleFavorite: (item: { id?: string; slug: string; name?: string }) => Promise<boolean>;
  refreshFavorites: () => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextValue>({
  favoriteIds: new Set(),
  favoriteProducts: [],
  loadingFavorites: false,
  isFavorite: () => false,
  toggleFavorite: async () => false,
  refreshFavorites: async () => {},
});

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const toast = useToast();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoriteProducts, setFavoriteProducts] = useState<CatalogItem[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);

  const fetchFavorites = useCallback(async () => {
    if (!session?.user?.id) {
      setFavoriteIds(new Set());
      setFavoriteProducts([]);
      return;
    }

    setLoadingFavorites(true);
    try {
      // 1. Fetch user_favorites from Supabase
      const { data: favRows, error: favErr } = await (supabase
        .from('user_favorites')
        .select('product_id, products(id, slug)') as any)
        .eq('user_id', session.user.id);

      if (favErr) {
        console.error('[Favorites] Error fetching favorites:', favErr);
        setLoadingFavorites(false);
        return;
      }

      if (!favRows || favRows.length === 0) {
        setFavoriteIds(new Set());
        setFavoriteProducts([]);
        setLoadingFavorites(false);
        return;
      }

      // Collect product IDs and slugs
      const newIds = new Set<string>();
      const prodIdsList: string[] = [];

      favRows.forEach((row: any) => {
        if (row.product_id) {
          newIds.add(row.product_id);
          prodIdsList.push(row.product_id);
        }
        if (row.products?.slug) {
          newIds.add(row.products.slug);
        }
        if (row.products?.id) {
          newIds.add(row.products.id);
        }
      });

      setFavoriteIds(newIds);

      // 2. Map full CatalogItem objects for favorites list
      const allCatalog = await fetchAllProducts();
      const favItems = allCatalog.filter((item) => newIds.has(item.id) || newIds.has(item.slug));
      setFavoriteProducts(favItems);
    } catch (err) {
      console.error('[Favorites] Unexpected error fetching favorites:', err);
    } finally {
      setLoadingFavorites(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const isFavorite = useCallback(
    (productIdOrSlug: string) => {
      if (!productIdOrSlug) return false;
      return favoriteIds.has(productIdOrSlug);
    },
    [favoriteIds]
  );

  const toggleFavorite = async (item: { id?: string; slug: string; name?: string }): Promise<boolean> => {
    if (!session?.user?.id) {
      toast.error('Vui lòng đăng nhập để lưu sản phẩm yêu thích!');
      return false;
    }

    const userId = session.user.id;
    const lookupKey = item.slug || item.id || '';
    const currentlyFav = favoriteIds.has(lookupKey) || (item.id ? favoriteIds.has(item.id) : false);

    // Resolve real UUID product_id
    let productId = item.id;
    if (!productId) {
      const { data: prodData } = await (supabase
        .from('products')
        .select('id')
        .eq('slug', item.slug)
        .single() as any);
      if (prodData?.id) {
        productId = prodData.id;
      }
    }

    if (!productId) {
      toast.error('Không tìm thấy thông tin sản phẩm!');
      return false;
    }

    // Optimistic UI Update
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (currentlyFav) {
        if (productId) next.delete(productId);
        if (item.slug) next.delete(item.slug);
      } else {
        if (productId) next.add(productId);
        if (item.slug) next.add(item.slug);
      }
      return next;
    });

    if (currentlyFav) {
      setFavoriteProducts((prev) => prev.filter((p) => p.id !== productId && p.slug !== item.slug));
    }

    try {
      if (currentlyFav) {
        // DELETE
        const { error } = await (supabase
          .from('user_favorites')
          .delete() as any)
          .eq('user_id', userId)
          .eq('product_id', productId);

        if (error) throw error;
        toast.success(`Đã bỏ "${item.name || 'Sản phẩm'}" khỏi danh sách yêu thích`);
        fetchFavorites();
        return false;
      } else {
        // INSERT
        const { error } = await (supabase
          .from('user_favorites')
          .insert({ user_id: userId, product_id: productId }) as any);

        if (error && !error.message?.includes('unique constraint')) throw error;
        toast.success(`❤️ Đã thêm "${item.name || 'Sản phẩm'}" vào yêu thích!`);
        fetchFavorites();
        return true;
      }
    } catch (err: any) {
      console.error('[Favorites] toggleFavorite failed:', err);
      toast.error('Lỗi khi cập nhật sản phẩm yêu thích.');
      // Rollback on error
      fetchFavorites();
      return currentlyFav;
    }
  };

  return (
    <FavoritesContext.Provider
      value={{
        favoriteIds,
        favoriteProducts,
        loadingFavorites,
        isFavorite,
        toggleFavorite,
        refreshFavorites: fetchFavorites,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
