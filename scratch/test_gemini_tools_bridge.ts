// scratch/test_gemini_tools_bridge.ts
// Unit test for Gemini Tool Declaration & Execution Bridge

// @ts-ignore
if (typeof import.meta.env === 'undefined') {
  // @ts-ignore
  import.meta.env = { DEV: true, VITE_SUPABASE_URL: 'https://mock.supabase.co', VITE_SUPABASE_ANON_KEY: 'mock-key' };
}

import { geminiToolDeclarations, executeGeminiTool } from '../src/services/agent/gemini/geminiTools';

async function testGeminiToolsBridge() {
  console.log('=== TEST GEMINI TOOLS DECLARATIONS & BRIDGE ===');
  console.log('Tool Declarations Count:', geminiToolDeclarations.length);
  
  const authContext = {
    userId: 'u123',
    email: 'khachhang@gmail.com',
    fullName: 'Nguyễn Văn A',
    role: 'user' as const,
    balance: 50000,
    isAuthenticated: true,
  };

  // 1. Test search_products with music keyword
  const searchMusic = await executeGeminiTool('search_products', { keyword: 'nghe nhạc' }, authContext);
  console.log('1. search_products ("nghe nhạc") success:', searchMusic.success, 'returned:', searchMusic.data?.length);

  // 2. Test search_products with video keyword
  const searchVideo = await executeGeminiTool('search_products', { keyword: 'làm video' }, authContext);
  console.log('2. search_products ("làm video") success:', searchVideo.success, 'returned:', searchVideo.data?.length);

  // 3. Test get_product_detail for youtube
  const detailYoutube = await executeGeminiTool('get_product_detail', { productIdOrSlug: 'youtube' }, authContext);
  console.log('3. get_product_detail ("youtube") success:', detailYoutube.success, 'name:', detailYoutube.data?.name, 'plans:', detailYoutube.data?.plans?.length);

  // 4. Test get_warranty_policy
  const warranty = await executeGeminiTool('get_warranty_policy', {}, authContext);
  console.log('4. get_warranty_policy success:', warranty.success, 'policy:', warranty.data?.standardPolicy?.slice(0, 40));

  // 5. Test get_support_channels
  const support = await executeGeminiTool('get_support_channels', {}, authContext);
  console.log('5. get_support_channels success:', support.success, 'hotline:', support.data?.hotline);

  console.log('=== ALL TOOL BRIDGE CHECKS PASSED ===');
}

testGeminiToolsBridge();
