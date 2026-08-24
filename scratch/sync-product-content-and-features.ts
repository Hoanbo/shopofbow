import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hzrbiadnppsehcfgufuw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface ProductContentSpec {
  slug: string;
  name: string;
  short_description: string;
  description: string;
  common_features: string[];
  plans: {
    name_match: string; // match by name or duration
    duration_match?: string;
    badge?: string;
    warranty: string;
    is_highlight?: boolean;
    plan_features: string[];
  }[];
}

const contentSpecs: ProductContentSpec[] = [
  // 1. CapCut Pro
  {
    slug: 'capcut-pro',
    name: 'CapCut Pro',
    short_description: 'Công cụ dựng video AI hàng đầu thế giới với kho template, âm thanh bản quyền và xuất video 4K 60fps.',
    description: `### 🎬 Tổng quan về CapCut Pro
CapCut Pro là phiên bản nâng cấp toàn diện của phần mềm chỉnh sửa video phổ biến nhất thế giới. Được tối ưu hóa cho cả máy tính (Windows/macOS) và điện thoại (iOS/Android), CapCut Pro trang bị hàng loạt công nghệ AI tân tiến giúp bạn tạo ra các video triệu view một cách chuyên nghiệp và tiết kiệm tối đa thời gian.

### ✨ Tính năng nổi bật của CapCut Pro
- **Xóa phông nền & Tách chủ thể siêu mượt**: Tách nền thông minh bằng AI chỉ với 1 click, không cần phông xanh.
- **Tự động tạo phụ đề đa ngôn ngữ (Auto Captions)**: Nhận diện giọng nói chuẩn xác và chèn phụ đề tự động theo phong cách phụ đề TikTok/Reels hiện đại.
- **Kho hiệu ứng, chuyển cảnh & Template VIP**: Mở khóa hơn 10.000+ hiệu ứng hình ảnh, bộ lọc màu điện ảnh và âm nhạc bản quyền thương mại.
- **Giảm nhiễu âm thanh & Giọng đọc AI sống động**: Lọc tạp âm môi trường và chuyển văn bản thành giọng đọc tự nhiên (Text-to-Speech).
- **Xuất video độ phân giải cao**: Xuất file chuẩn 4K, tốc độ khung hình 60fps mượt mà, không dính logo (watermark).

### 🎯 Đối tượng phù hợp
- Content Creator, TikToker, YouTuber, Video Editor.
- Doanh nghiệp, chủ shop bán hàng online, marketer làm video quảng cáo.
- Bất kỳ ai đam mê sáng tạo nội dung video ngắn và dài.`,
    common_features: [
      'Mở khóa toàn bộ hiệu ứng & mẫu Template VIP',
      'Tạo phụ đề tự động bằng AI (Auto Captions)',
      'Tách phông nền và chỉnh sửa màu nâng cao',
      'Xuất video 4K 60fps không dính logo watermark',
      'Hỗ trợ đa nền tảng PC / Mac / iOS / Android'
    ],
    plans: [
      {
        name_match: '1 tuần',
        duration_match: '7 ngày',
        badge: 'Gói tuần',
        warranty: 'Full thời gian',
        is_highlight: false,
        plan_features: [
          'Sử dụng 7 ngày liên tục',
          'Mở khóa 100% tính năng Pro',
          'Xuất video 4K không giới hạn',
          'Bảo hành 1 đổi 1 trong 7 ngày'
        ]
      },
      {
        name_match: '1 tháng',
        duration_match: '30 ngày',
        badge: 'Bán chạy',
        warranty: 'Full thời gian',
        is_highlight: true,
        plan_features: [
          'Sử dụng trọn vẹn 30 ngày',
          'Đầy đủ tính năng AI và Template Pro',
          'Đồng bộ dữ liệu đa thiết bị',
          'Bảo hành Full thời gian sử dụng'
        ]
      },
      {
        name_match: '6 tháng',
        duration_match: '180 ngày',
        badge: 'Tiết kiệm',
        warranty: 'Full thời gian',
        is_highlight: false,
        plan_features: [
          'Sử dụng ổn định 180 ngày',
          'Tiết kiệm hơn 40% so với mua lẻ từng tháng',
          'Ưu tiên hỗ trợ kỹ thuật',
          'Bảo hành trọn chu kỳ 6 tháng'
        ]
      }
    ]
  },

  // 2. Netflix Premium
  {
    slug: 'netflix-premium',
    name: 'Netflix Premium',
    short_description: 'Xem phim bom tấn chuẩn 4K Ultra HD & HDR, âm thanh không gian Spatial Audio, không quảng cáo.',
    description: `### 🍿 Trải nghiệm điện ảnh đỉnh cao cùng Netflix Premium
Netflix Premium là gói đăng ký cao cấp nhất của nền tảng phát trực tuyến hàng đầu thế giới, mang đến cho bạn hàng ngàn tựa phim điện ảnh độc quyền (Netflix Originals), phim truyền hình đạt giải thưởng, phim hoạt hình và phim tài liệu hấp dẫn.

### 🌟 Quyền lợi tài khoản
- **Độ phân giải 4K UHD & Dolby Vision**: Hình ảnh sắc nét gấp 4 lần Full HD với dải màu tương phản sống động.
- **Âm thanh không gian Spatial Audio**: Tái tạo không gian âm thanh vòm sống động như tại rạp chiếu phim.
- **Profile cá nhân hóa**: Tạo profile riêng tư, lưu danh sách phim yêu thích và lịch sử xem độc lập.
- **Tải xuống xem ngoại tuyến**: Thưởng thức nội dung mọi lúc mọi nơi ngay cả khi không có kết nối Internet.
- **Không bao giờ bị làm phiền**: Hoàn toàn không có quảng cáo trong suốt quá trình thưởng thức.`,
    common_features: [
      'Chất lượng hình ảnh 4K Ultra HD + HDR',
      'Âm thanh vòm Spatial Audio / Dolby Atmos',
      'Xem phim không giới hạn, không quảng cáo',
      'Profile cá nhân hóa danh sách xem riêng biệt',
      'Hỗ trợ Smart TV, Điện thoại, Tablet, PC'
    ],
    plans: [
      {
        name_match: '1 tháng',
        duration_match: '30 ngày',
        badge: 'Gói 1 tháng',
        warranty: 'Full thời gian',
        is_highlight: true,
        plan_features: [
          '1 Profile riêng có đặt mã PIN',
          'Độ phân giải 4K UHD sắc nét',
          'Sử dụng liên tục 30 ngày',
          'Bảo hành 1 đổi 1 suốt thời gian dùng'
        ]
      },
      {
        name_match: 'Extra Member 1 tháng',
        duration_match: '30 ngày',
        badge: 'Chính chủ',
        warranty: 'Full thời gian',
        is_highlight: false,
        plan_features: [
          'Suất thành viên phụ Extra Member chính chủ',
          'Đăng nhập bằng chính email của bạn',
          'Độc lập hoàn toàn, không chung đụng',
          'Bảo hành trọn vẹn 30 ngày'
        ]
      }
    ]
  },

  // 3. Canva Pro
  {
    slug: 'canva-pro',
    name: 'Canva Pro',
    short_description: 'Nền tảng thiết kế đồ họa kéo thả số 1 thế giới với kho 100M+ ảnh/video/vector và công cụ Magic AI.',
    description: `### 🎨 Thiết kế đỉnh cao không giới hạn cùng Canva Pro
Canva Pro là giải pháp hoàn hảo giúp bất kỳ ai — từ người mới bắt đầu đến nhà thiết kế chuyên nghiệp — đều có thể tạo ra các ấn phẩm truyền thông, banner, logo, slide thuyết trình và video mạng xã hội xuất sắc trong vài phút.

### 🚀 Tính năng vượt trội của Canva Pro
- **Bộ công cụ Magic Studio (AI Design)**: Magic Eraser (xóa vật thể), Magic Expand (mở rộng ảnh), Magic Switch (đổi kích thước đa nền tảng tức thì).
- **Kho tài nguyên Premium không giới hạn**: Mở khóa hơn 100 triệu hình ảnh, video, đồ họa vector và font chữ độc quyền.
- **Xóa phông nền 1 chạm (Background Remover)**: Tách nền hình ảnh và video chuẩn xác chỉ với một cú nhấp chuột.
- **Brand Kit (Bộ nhận diện thương hiệu)**: Lưu trữ bảng màu, logo và typography riêng biệt để đồng bộ hình ảnh thương hiệu.`,
    common_features: [
      'Mở khóa hơn 100M+ hình ảnh, video, vector Premium',
      'Bộ công cụ trí tuệ nhân tạo Magic Studio',
      'Xóa nền ảnh & video 1 click (Background Remover)',
      'Tải xuống định dạng SVG, PNG trong suốt, PDF in ấn',
      'Bộ nhớ đám mây lưu trữ thiết kế dung lượng lớn'
    ],
    plans: [
      {
        name_match: 'Slot 1 tháng',
        duration_match: '30 ngày',
        badge: 'Cá nhân',
        warranty: 'Full thời gian',
        is_highlight: false,
        plan_features: [
          'Nâng cấp trực tiếp trên email cá nhân',
          'Đầy đủ quyền năng Canva Pro 30 ngày',
          'Thiết kế lưu trữ riêng tư 100%',
          'Bảo hành Full 30 ngày'
        ]
      },
      {
        name_match: 'Slot Edu 1 năm',
        duration_match: '365 ngày',
        badge: 'Tiết kiệm 1 năm',
        warranty: 'Full thời gian',
        is_highlight: true,
        plan_features: [
          'Thời hạn sử dụng 1 năm (365 ngày)',
          'Đầy đủ tính năng thiết kế Pro & Giáo dục',
          'Nâng cấp vào tài khoản cá nhân',
          'Bảo hành chu đáo trọn năm'
        ]
      },
      {
        name_match: 'Admin Business 100 Slot (1 tháng)',
        duration_match: '30 ngày',
        badge: 'Admin 100 Slot',
        warranty: 'Full thời gian',
        is_highlight: false,
        plan_features: [
          'Quyền quản trị viên Team Doanh nghiệp',
          'Cung cấp tối đa 100 thành viên (Slot)',
          'Tự do thêm/bớt thành viên theo ý muốn',
          'Bảo hành quản trị viên 1 tháng'
        ]
      },
      {
        name_match: 'Admin Business 100 Slot (3 tháng)',
        duration_match: '90 ngày',
        badge: 'Admin 3 Tháng',
        warranty: 'Full thời gian',
        is_highlight: false,
        plan_features: [
          'Quyền quản trị viên Team Doanh nghiệp 90 ngày',
          'Quản lý 100 vị trí thành viên',
          'Tiết kiệm chi phí vận hành cho tổ chức',
          'Bảo hành Full 3 tháng'
        ]
      }
    ]
  },

  // 4. Adobe Full Apps
  {
    slug: 'adobe-full-apps',
    name: 'Adobe Full Apps',
    short_description: 'Trọn bộ 20+ ứng dụng đồ họa chuyên nghiệp Photoshop, Illustrator, Premiere Pro, After Effects và Adobe Firefly AI.',
    description: `### 🖌️ Sức mạnh sáng tạo không biên giới từ Adobe Creative Cloud
Bộ ứng dụng Adobe Creative Cloud Full Apps là tiêu chuẩn vàng của ngành công nghiệp sáng tạo toàn cầu, đáp ứng mọi nhu cầu từ thiết kế đồ họa 2D/3D, chỉnh sửa ảnh, dựng phim, kỹ xảo điện ảnh đến thiết kế UI/UX.

### 🌟 Danh mục ứng dụng nổi bật
- **Chỉnh sửa ảnh & Đồ họa**: Adobe Photoshop, Lightroom, Illustrator, InDesign.
- **Dựng phim & Kỹ xảo**: Adobe Premiere Pro, After Effects, Audition, Media Encoder.
- **Adobe Firefly AI**: Tạo ảnh và xử lý Generative Fill đỉnh cao bằng trí tuệ nhân tạo.
- **Bộ nhớ đám mây Adobe Cloud**: Đồng bộ dự án, font chữ Adobe Fonts và thư viện asset mượt mà.`,
    common_features: [
      'Trọn bộ 20+ phần mềm Adobe mới nhất',
      'Tích hợp tính năng Adobe Firefly Generative Fill',
      'Đăng nhập và sử dụng trực tiếp ứng dụng bản quyền',
      'Hỗ trợ cài đặt trên cả Windows và macOS',
      'Truy cập thư viện font Adobe Fonts cao cấp'
    ],
    plans: [
      {
        name_match: '2 tháng (BH 24H)',
        duration_match: '60 ngày',
        badge: 'Creative Cloud',
        warranty: '24 giờ',
        is_highlight: true,
        plan_features: [
          'Truy cập trọn gói Full 20+ App Adobe',
          'Thời lượng sử dụng 2 tháng',
          'Kích hoạt nhanh chóng',
          'Chính sách bảo hành 24 giờ sau bàn giao'
        ]
      }
    ]
  },

  // 5. YouTube Premium
  {
    slug: 'youtube-premium',
    name: 'YouTube Premium',
    short_description: 'Thưởng thức video không quảng cáo, phát trong nền khi tắt màn hình và kèm theo YouTube Music Premium.',
    description: `### 🎵 Giải trí liền mạch cùng YouTube Premium
YouTube Premium nâng tầm trải nghiệm giải trí của bạn trên nền tảng video lớn nhất thế giới, loại bỏ hoàn toàn các đoạn quảng cáo phiền toái và mang lại những tính năng tiện ích vượt trội.

### 🎧 Quyền lợi nổi bật
- **Không có quảng cáo**: Xem video mượt mà từ đầu đến cuối mà không bị gián đoạn.
- **Phát trong nền (Background Play)**: Video và nhạc tiếp tục phát khi bạn chuyển ứng dụng hoặc tắt màn hình điện thoại.
- **YouTube Music Premium miễn phí đi kèm**: Truy cập hàng triệu bài hát chất lượng cao, tạo playlist cá nhân và nghe nhạc offline.
- **Tải video xem ngoại tuyến**: Lưu video yêu thích ở độ phân giải cao để xem khi đi du lịch hoặc không có mạng.`,
    common_features: [
      'Loại bỏ 100% quảng cáo trên tất cả thiết bị',
      'Phát âm thanh trong nền khi tắt màn hình điện thoại',
      'Tặng kèm tài khoản YouTube Music Premium',
      'Tải video chất lượng Full HD xem ngoại tuyến',
      'Nâng cấp chính chủ trên chính tài khoản Google của bạn'
    ],
    plans: [
      {
        name_match: 'Slot 1 tháng',
        duration_match: '30 ngày',
        badge: '1 tháng',
        warranty: 'Full thời gian',
        is_highlight: false,
        plan_features: [
          'Sử dụng liên tục 30 ngày',
          'Nâng cấp Family Group chính chủ',
          'Đầy đủ YouTube Music Premium',
          'Bảo hành trọn vẹn 30 ngày'
        ]
      },
      {
        name_match: 'Slot 3 tháng',
        duration_match: '90 ngày',
        badge: '3 tháng',
        warranty: 'Full thời gian',
        is_highlight: false,
        plan_features: [
          'Sử dụng ổn định 90 ngày',
          'Không gián đoạn trải nghiệm nghe nhìn',
          'Chính chủ trên email của bạn',
          'Bảo hành Full 3 tháng'
        ]
      },
      {
        name_match: 'Slot 6 tháng',
        duration_match: '180 ngày',
        badge: '6 tháng',
        warranty: 'Full thời gian',
        is_highlight: true,
        plan_features: [
          'Thời hạn 180 ngày bền vững',
          'Mức giá ưu đãi tiết kiệm',
          'Xem mượt mà trên TV, Phone, PC',
          'Bảo hành chu đáo 6 tháng'
        ]
      },
      {
        name_match: 'Slot 12 tháng',
        duration_match: '365 ngày',
        badge: 'Gói 1 năm',
        warranty: 'Full thời gian',
        is_highlight: false,
        plan_features: [
          'Trọn vẹn 365 ngày (1 năm)',
          'Tiết kiệm tối đa chi phí đăng ký',
          'Kích hoạt chính chủ an toàn',
          'Bảo hành uy tín trọn năm'
        ]
      }
    ]
  },

  // 6. Google One AI Pro 5TB
  {
    slug: 'google-ai-pro-5tb',
    name: 'Google One AI Pro 5TB',
    short_description: 'Nâng cấp dung lượng 5TB Google Drive chính chủ kết hợp quyền năng Gemini Advanced đỉnh cao.',
    description: `### ☁️ Dung lượng khổng lồ 5TB & Trí tuệ nhân tạo Gemini Advanced
Gói Google One AI Pro 5TB là sự kết hợp hoàn hảo giữa không gian lưu trữ đám mây khổng lồ 5.000GB cho Google Drive/Gmail/Google Photos và trợ lý trí tuệ nhân tạo Gemini Advanced thế hệ mới nhất của Google.

### 💡 Lợi ích mang lại
- **5.000 GB (5TB) dung lượng lưu trữ**: Thỏa sức sao lưu video 4K, ảnh gốc chất lượng cao, tài liệu dự án lớn mà không lo đầy bộ nhớ.
- **Gemini Advanced (Mô hình 1.5 Pro)**: Xử lý ngữ cảnh lên đến 1 triệu token, phân tích tài liệu PDF hàng ngàn trang, viết code và sáng tạo nội dung vượt trội.
- **Tích hợp sâu trong Google Workspace**: Sử dụng Gemini trực tiếp trong Google Docs, Gmail, Sheets và Slides để tối ưu hóa hiệu suất công việc.`,
    common_features: [
      'Không gian lưu trữ 5.000GB (5TB) đám mây tốc độ cao',
      'Trợ lý AI Gemini Advanced mạnh mẽ nhất từ Google',
      'Tích hợp AI trực tiếp trong Gmail, Docs, Sheets',
      'Chia sẻ dung lượng cho tối đa 5 thành viên gia đình',
      'Nâng cấp trực tiếp trên chính tài khoản Google của bạn'
    ],
    plans: [
      {
        name_match: 'Nâng chính chủ 1 năm (BH 1 tháng)',
        duration_match: '365 ngày',
        badge: 'BH 1 Tháng',
        warranty: '1 tháng',
        is_highlight: false,
        plan_features: [
          'Nâng cấp chính chủ email Google của bạn',
          'Dung lượng 5TB + Gemini Advanced',
          'Thời hạn hiển thị 1 năm',
          'Chính sách bảo hành 1 tháng'
        ]
      },
      {
        name_match: 'Nâng chính chủ 1 năm (BH Full 1 năm)',
        duration_match: '365 ngày',
        badge: 'Full BH 1 Năm',
        warranty: 'Full 1 năm',
        is_highlight: true,
        plan_features: [
          'Nâng cấp chính chủ an toàn 100%',
          'Dung lượng 5TB + Gemini Advanced trọn vẹn',
          'Hỗ trợ kỹ thuật ưu tiên',
          'Bảo hành Full 1 năm suốt thời gian dùng'
        ]
      }
    ]
  },

  // 7. Gemini Pro
  {
    slug: 'gemini-pro',
    name: 'Gemini Pro',
    short_description: 'Trợ lý AI thông minh đa phương thức từ Google, phân tích dữ liệu lớn và sáng tạo nội dung vượt trội.',
    description: `### 🤖 Trải nghiệm trí tuệ nhân tạo Gemini Pro thế hệ mới
Gemini Pro mang đến sức mạnh xử lý ngôn ngữ tự nhiên và phân tích dữ liệu hình ảnh, âm thanh, video đa phương thức với tốc độ cực nhanh, giúp bạn giải quyết các bài toán phức tạp trong học tập và nghiên cứu.`,
    common_features: [
      'Mô hình ngôn ngữ lớn tiên tiến nhất từ Google',
      'Phân tích ngữ cảnh sâu và tải lên dữ liệu đa dạng',
      'Viết mã nguồn, dịch thuật và tóm tắt văn bản chuẩn xác',
      'Tốc độ phản hồi nhanh, hoạt động ổn định 24/7'
    ],
    plans: [
      {
        name_match: 'Slot 1 năm (BH 1 tháng)',
        duration_match: '365 ngày',
        badge: 'BH 1 Tháng',
        warranty: '1 tháng',
        is_highlight: false,
        plan_features: [
          'Slot sử dụng 1 năm',
          'Đầy đủ quyền năng Gemini Pro',
          'Bảo hành kỹ thuật 1 tháng'
        ]
      },
      {
        name_match: 'Slot 1 năm (BH 3 tháng)',
        duration_match: '365 ngày',
        badge: 'BH 3 Tháng',
        warranty: '3 tháng',
        is_highlight: false,
        plan_features: [
          'Slot sử dụng 1 năm',
          'Bảo hành kỹ thuật 3 tháng',
          'Hỗ trợ đổi mới nhanh chóng'
        ]
      },
      {
        name_match: 'Slot 1 năm (BH 6 tháng)',
        duration_match: '365 ngày',
        badge: 'BH 6 Tháng',
        warranty: '6 tháng',
        is_highlight: false,
        plan_features: [
          'Slot sử dụng 1 năm',
          'Bảo hành chu đáo 6 tháng',
          'Đảm bảo trải nghiệm ổn định'
        ]
      },
      {
        name_match: 'Slot Gemini Pro + GG 5TB (1 năm)',
        duration_match: '365 ngày',
        badge: 'Combo 5TB',
        warranty: 'Full thời gian',
        is_highlight: true,
        plan_features: [
          'Combo Gemini Pro + Google Drive 5TB',
          'Thời hạn 1 năm trọn vẹn',
          'Lưu trữ và làm việc AI không giới hạn',
          'Bảo hành Full thời gian sử dụng'
        ]
      }
    ]
  },

  // 8. Wink VIP+
  {
    slug: 'wink-vip',
    name: 'Wink VIP+',
    short_description: 'Ứng dụng làm đẹp và phục chế video AI 4K hàng đầu châu Á, làm nét mặt và chỉnh dáng video chuyên nghiệp.',
    description: `### ✨ Phục chế và làm đẹp video AI chuyên nghiệp với Wink VIP+
Wink là ứng dụng chỉnh sửa video chân dung và làm đẹp video bằng AI hàng đầu hiện nay. Với phiên bản VIP+, bạn có thể làm nét video mờ thành chuẩn 4K, làm mịn da, thon gọn dáng và trang điểm tự nhiên trực tiếp trên video chuyển động.`,
    common_features: [
      'Làm nét video bằng AI chuẩn 4K (Ultra HD Enhancement)',
      'Chỉnh sửa khuôn mặt, làm mịn da và trang điểm tự nhiên trong video',
      'Thon gọn vóc dáng cơ thể chuyển động mượt mà',
      'Xóa vật thể thừa và người lạ trong video bằng AI',
      'Mở khóa toàn bộ bộ lọc màu và hiệu ứng VIP+'
    ],
    plans: [
      {
        name_match: '1 tuần',
        duration_match: '7 ngày',
        badge: 'Gói tuần',
        warranty: 'Full thời gian',
        is_highlight: false,
        plan_features: [
          'Trọn vẹn 7 ngày sử dụng',
          'Mở khóa tính năng phục chế video 4K',
          'Bảo hành 1 đổi 1 suốt 7 ngày'
        ]
      },
      {
        name_match: '1 tháng',
        duration_match: '30 ngày',
        badge: 'Khuyên dùng',
        warranty: 'Full thời gian',
        is_highlight: true,
        plan_features: [
          'Sử dụng không giới hạn 30 ngày',
          'Đầy đủ công cụ AI VIP+ mạnh mẽ nhất',
          'Bảo hành Full thời gian sử dụng'
        ]
      }
    ]
  },

  // 9. MeiTu SVIP
  {
    slug: 'meitu-svip',
    name: 'Meitu SVIP',
    short_description: 'Ứng dụng chỉnh sửa ảnh & làm đẹp AI số 1 với kho filter thần thánh, xóa người AI và tạo avatar nghệ thuật.',
    description: `### 📸 Đỉnh cao nhiếp ảnh chân dung và sáng tạo nghệ thuật cùng Meitu SVIP
Meitu SVIP cung cấp bộ công cụ chỉnh ảnh toàn diện nhất hiện nay, từ trang điểm tự động, chỉnh sửa tỉ lệ gương mặt, xóa phông nền AI đến kho hiệu ứng đồ sộ giúp các bức ảnh của bạn trở nên lộng lẫy và thu hút.`,
    common_features: [
      'Mở khóa tất cả tính năng Meitu SVIP cao cấp',
      'Công cụ xóa vật thể và phục chế ảnh cũ bằng AI',
      'Hàng ngàn bộ lọc màu hot trend xứ Trung độc quyền',
      'Chỉnh sửa chân dung chi tiết từng đường nét khuôn mặt',
      'Xuất ảnh độ phân giải gốc siêu nét'
    ],
    plans: [
      {
        name_match: '1 tuần',
        duration_match: '7 ngày',
        badge: 'Gói tuần',
        warranty: 'Full thời gian',
        is_highlight: false,
        plan_features: [
          'Sử dụng 7 ngày liên tục',
          'Mở khóa 100% tính năng SVIP',
          'Bảo hành 1 đổi 1 trong 7 ngày'
        ]
      },
      {
        name_match: '1 tháng',
        duration_match: '30 ngày',
        badge: 'Bán chạy',
        warranty: 'Full thời gian',
        is_highlight: true,
        plan_features: [
          'Thời hạn 30 ngày ổn định',
          'Đầy đủ bộ lọc và công cụ AI',
          'Bảo hành trọn vẹn 30 ngày'
        ]
      }
    ]
  },

  // 10. XingTu VIP
  {
    slug: 'xingtu',
    name: 'XingTu',
    short_description: 'App chỉnh ảnh tỷ lệ vàng thần thánh của các tỉ tỉ Douyin, làm đẹp tự nhiên và màu ảnh phim nghệ thuật.',
    description: `### 🌺 Bí quyết ảnh vạn người mê cùng XingTu VIP (醒图)
XingTu là ứng dụng chỉnh ảnh thần thánh được các hot creator Douyin và mạng xã hội yêu thích nhất. Với các tính năng AI định hình khuôn mặt tỉ lệ vàng, kéo sáng thông minh và màu ảnh phim hoài cổ, XingTu giúp bạn biến hóa mọi bức ảnh thành kiệt tác.`,
    common_features: [
      'Mở khóa trọn vẹn tính năng XingTu VIP bản quyền',
      'Định hình khuôn mặt và làm đẹp tự nhiên chuẩn tỉ lệ vàng',
      'Bộ sưu tập màu ảnh phim, vintage và cinematic độc quyền',
      'Tách nền và ghép mây, ghép trời nghệ thuật bằng AI',
      'Giao diện trực quan, dễ dàng sử dụng'
    ],
    plans: [
      {
        name_match: 'VIP 1 tháng',
        duration_match: '30 ngày',
        badge: 'XingTu VIP',
        warranty: 'Full thời gian',
        is_highlight: true,
        plan_features: [
          'Sử dụng trọn vẹn 30 ngày',
          'Mở khóa 100% công cụ VIP',
          'Xuất ảnh chất lượng cao không nén',
          'Bảo hành Full thời gian'
        ]
      }
    ]
  },

  // 11. Kling AI
  {
    slug: 'kling-ai',
    name: 'Kling AI',
    short_description: 'Nền tảng tạo video AI siêu thực đỉnh cao thế giới, chuyển văn bản và hình ảnh thành video chân thực.',
    description: `### 🎥 Sáng tạo video điện ảnh bằng trí tuệ nhân tạo Kling AI
Kling AI là một trong những công nghệ sinh video bằng trí tuệ nhân tạo (Text-to-Video & Image-to-Video) tiên tiến nhất thế giới hiện nay, tạo ra các video chân thực với chuyển động mượt mà, vật lý chuẩn xác và độ phân giải cao.`,
    common_features: [
      'Tạo video siêu thực từ văn bản (Text-to-Video) và ảnh (Image-to-Video)',
      'Mô phỏng vật lý chuyển động chuẩn xác và biểu cảm khuôn mặt sống động',
      'Hỗ trợ tạo video độ phân giải Full HD / 4K tốc độ cao',
      'Điều khiển góc quay camera và chuyển động khung hình linh hoạt'
    ],
    plans: [
      {
        name_match: '65 Credit',
        duration_match: '30 ngày',
        badge: 'Gói trải nghiệm',
        warranty: 'Full thời gian',
        is_highlight: false,
        plan_features: [
          'Gói 65 Credit tạo video',
          'Hạn dùng 30 ngày',
          'Phù hợp dùng thử và trải nghiệm',
          'Bảo hành Full thời gian'
        ]
      },
      {
        name_match: 'Random 600-1.100 Credit',
        duration_match: '30 ngày',
        badge: 'Phổ biến',
        warranty: 'Full thời gian',
        is_highlight: true,
        plan_features: [
          'Nhận ngẫu nhiên 600 đến 1.100 Credit',
          'Thỏa sức sáng tạo hàng chục video AI',
          'Hạn dùng 30 ngày',
          'Bảo hành Full thời gian'
        ]
      },
      {
        name_match: '3.300 Credit (BH 7 ngày)',
        duration_match: '30 ngày',
        badge: 'Khủng 3300 Cre',
        warranty: '7 ngày',
        is_highlight: false,
        plan_features: [
          'Số lượng cực lớn 3.300 Credit',
          'Dành cho dự án dựng phim và Creator chuyên nghiệp',
          'Thời hạn dùng 30 ngày',
          'Chính sách bảo hành 7 ngày'
        ]
      }
    ]
  },

  // 12. Perplexity Pro
  {
    slug: 'perplexity-pro',
    name: 'Perplexity Pro',
    short_description: 'Công cụ tìm kiếm AI thế hệ mới với Pro Search, trích dẫn nguồn học thuật chuẩn xác và chọn mô hình Claude 3.5 / GPT-4o.',
    description: `### 🔍 Nghiên cứu và tìm kiếm thông tin thông minh cùng Perplexity Pro
Perplexity Pro định nghĩa lại cách chúng ta tiếp cận thông tin trên Internet bằng cách tổng hợp câu trả lời tức thì, minh bạch nguồn dữ liệu, đính kèm tài liệu học thuật và cho phép tùy chọn các mô hình AI thông minh nhất thế giới.`,
    common_features: [
      'Pro Search không giới hạn hàng ngày',
      'Tùy chọn linh hoạt mô hình AI: GPT-4o, Claude 3.5 Sonnet, Sonar Large',
      'Tải lên file PDF, tài liệu lớn và hình ảnh để phân tích chuyên sâu',
      'Trích dẫn chính xác liên kết nguồn gốc của mọi thông tin',
      'Tạo không gian nghiên cứu riêng biệt (Collections)'
    ],
    plans: [
      {
        name_match: '1 tháng',
        duration_match: '30 ngày',
        badge: '1 tháng',
        warranty: 'Full thời gian',
        is_highlight: true,
        plan_features: [
          'Sử dụng liên tục 30 ngày',
          'Không giới hạn lượt Pro Search',
          'Đầy đủ các mô hình GPT-4o & Claude 3.5',
          'Bảo hành Full 30 ngày'
        ]
      },
      {
        name_match: '10-11 tháng',
        duration_match: '330 ngày',
        badge: 'Gói năm tiết kiệm',
        warranty: 'Full thời gian',
        is_highlight: false,
        plan_features: [
          'Thời hạn dài 10-11 tháng',
          'Tiết kiệm chi phí nghiên cứu lâu dài',
          'Hỗ trợ kỹ thuật ưu tiên',
          'Bảo hành trọn vẹn suốt chu kỳ'
        ]
      }
    ]
  },

  // 13. Microsoft 365 Family
  {
    slug: 'microsoft-365-family',
    name: 'Microsoft 365 Family',
    short_description: 'Trọn bộ Word, Excel, PowerPoint, Outlook bản quyền chính chủ kèm 1.000GB (1TB) OneDrive tốc độ cao.',
    description: `### 💼 Bộ ứng dụng văn phòng bản quyền Microsoft 365 Family
Microsoft 365 mang đến môi trường làm việc hiệu quả nhất với các phần mềm văn phòng kinh điển được cập nhật tính năng mới nhất, kết hợp cùng 1TB dung lượng đám mây OneDrive sao lưu an toàn mọi tài liệu và hình ảnh của bạn.`,
    common_features: [
      'Trọn bộ Word, Excel, PowerPoint, Outlook, OneNote bản quyền',
      '1.000 GB (1TB) dung lượng lưu trữ đám mây OneDrive riêng tư',
      'Cài đặt trên tối đa 5 thiết bị (PC, Mac, iPhone, iPad, Android)',
      'Nâng cấp trực tiếp trên chính tài khoản Microsoft cá nhân của bạn',
      'Tự động sao lưu dữ liệu và chống mã độc tống tiền (Ransomware)'
    ],
    plans: [
      {
        name_match: 'Slot 1 năm',
        duration_match: '365 ngày',
        badge: '1TB OneDrive',
        warranty: 'Full thời gian',
        is_highlight: true,
        plan_features: [
          'Thời hạn 365 ngày (1 năm)',
          '1TB OneDrive hoàn toàn riêng tư',
          'Đăng nhập trên 5 thiết bị cá nhân',
          'Bảo hành trọn vẹn 1 năm'
        ]
      }
    ]
  },

  // 14. API CODEX
  {
    slug: 'api-codex',
    name: 'API CODEX',
    short_description: 'API key tốc độ cao kết nối các mô hình AI lập trình và sinh mã nguồn thông minh.',
    description: `### 💻 Kết nối API AI hiệu năng cao cho Lập trình viên
Dịch vụ cung cấp API Key AI với hạn mức token lớn, độ trễ cực thấp, tương thích hoàn toàn với các công cụ phát triển phần mềm, IDE và plugin lập trình hiện đại.`,
    common_features: [
      'Tốc độ phản hồi cực nhanh, độ trễ thấp',
      'Tương thích hoàn hảo các framework và SDK phổ biến',
      'Hạn mức token dồi dào, ổn định cao',
      'Bàn giao API Key ngay lập tức sau khi thanh toán'
    ],
    plans: [
      {
        name_match: '10M Token',
        duration_match: '1 ngày',
        badge: '10M Token',
        warranty: 'Full thời gian',
        is_highlight: false,
        plan_features: [
          'Hạn mức 10 triệu Token',
          'Sử dụng trong 24 giờ',
          'Bàn giao Key tức thì',
          'Bảo hành Full thời gian'
        ]
      },
      {
        name_match: '50M Token',
        duration_match: '1 ngày',
        badge: '50M Token',
        warranty: 'Full thời gian',
        is_highlight: true,
        plan_features: [
          'Hạn mức 50 triệu Token',
          'Sử dụng trong 24 giờ',
          'Phù hợp khối lượng công việc lớn',
          'Bảo hành Full thời gian'
        ]
      },
      {
        name_match: '100M Token',
        duration_match: '1 ngày',
        badge: '100M Khủng',
        warranty: 'Full thời gian',
        is_highlight: false,
        plan_features: [
          'Hạn mức cực đại 100 triệu Token',
          'Sử dụng trong 24 giờ',
          'Dành cho dự án lớn và doanh nghiệp',
          'Bảo hành Full thời gian'
        ]
      }
    ]
  },

  // 15. API Claude
  {
    slug: 'api-claude',
    name: 'API Claude',
    short_description: 'API Claude 3.5 Sonnet / Haiku chính hãng từ Anthropic với khả năng suy luận logic và viết code siêu việt.',
    description: `### ⚡ Sức mạnh xử lý ngôn ngữ và logic đỉnh cao từ Claude API
API Claude cung cấp quyền truy cập trực tiếp vào các mô hình trí tuệ nhân tạo hàng đầu từ Anthropic, nổi tiếng với khả năng hiểu ngữ cảnh phức tạp, viết văn phong tự nhiên và giải quyết các bài toán logic tinh vi.`,
    common_features: [
      'Mô hình AI hàng đầu về lập trình và phân tích logic',
      'Cửa sổ ngữ cảnh cực lớn, xử lý tài liệu dài',
      'Định dạng chuẩn REST API dễ dàng tích hợp',
      'Hạ tầng ổn định, uptime cao'
    ],
    plans: [
      {
        name_match: '10M Token',
        duration_match: '1 ngày',
        badge: '10M Token',
        warranty: 'Full thời gian',
        is_highlight: false,
        plan_features: [
          'Hạn mức 10 triệu Token Claude',
          'Sử dụng trong 24 giờ',
          'Bảo hành Full thời gian'
        ]
      },
      {
        name_match: '50M Token',
        duration_match: '1 ngày',
        badge: '50M Token',
        warranty: 'Full thời gian',
        is_highlight: true,
        plan_features: [
          'Hạn mức 50 triệu Token Claude',
          'Sử dụng trong 24 giờ',
          'Bảo hành Full thời gian'
        ]
      },
      {
        name_match: '100M Token',
        duration_match: '1 ngày',
        badge: '100M Token',
        warranty: 'Full thời gian',
        is_highlight: false,
        plan_features: [
          'Hạn mức 100 triệu Token Claude',
          'Sử dụng trong 24 giờ',
          'Bảo hành Full thời gian'
        ]
      }
    ]
  },

  // 16. ElevenLabs
  {
    slug: 'elevenlabs',
    name: 'ElevenLabs',
    short_description: 'Nền tảng lồng tiếng và nhân bản giọng nói AI (Voice Cloning) tự nhiên và chân thực nhất thế giới.',
    description: `### 🎙️ Công nghệ chuyển văn bản thành giọng nói AI số 1 thế giới
ElevenLabs dẫn đầu cuộc cách mạng âm thanh AI với khả năng tái tạo cảm xúc con người, giọng đọc tự nhiên đa ngôn ngữ và tính năng Voice Cloning cho phép tạo ra bản sao giọng nói hoàn hảo chỉ từ một đoạn audio mẫu ngắn.`,
    common_features: [
      'Giọng đọc AI tự nhiên nhất thế giới, hỗ trợ hơn 29+ ngôn ngữ',
      'Công nghệ nhân bản giọng nói (Voice Cloning) chính xác',
      'Tùy chỉnh độ biểu cảm, tốc độ và cảm xúc của giọng đọc',
      'Quyền thương mại sử dụng âm thanh cho video và podcast'
    ],
    plans: [
      {
        name_match: 'Redeem 300K Credit (1 tháng)',
        duration_match: '30 ngày',
        badge: '300K Credit',
        warranty: 'Full thời gian',
        is_highlight: true,
        plan_features: [
          'Mã Redeem 300.000 Credit',
          'Hạn dùng 30 ngày',
          'Nhân bản và tạo giọng đọc đa ngôn ngữ',
          'Bảo hành Full thời gian'
        ]
      },
      {
        name_match: 'Redeem 1M Credit (1 tháng)',
        duration_match: '30 ngày',
        badge: '1M Credit',
        warranty: 'Full thời gian',
        is_highlight: false,
        plan_features: [
          'Mã Redeem khủng 1.000.000 Credit',
          'Hạn dùng 30 ngày',
          'Dành cho studio sản xuất podcast/video lớn',
          'Bảo hành Full thời gian'
        ]
      }
    ]
  },

  // 17. Autodesk All Apps
  {
    slug: 'autodesk-all-apps',
    name: 'Autodesk All Apps',
    short_description: 'Trọn bộ phần mềm thiết kế kỹ thuật, kiến trúc và đồ họa 3D hàng đầu: AutoCAD, 3ds Max, Maya, Revit.',
    description: `### 📐 Bộ phần mềm kỹ thuật và đồ họa 3D chuyên nghiệp Autodesk
Autodesk cung cấp các công cụ tiêu chuẩn toàn cầu dành cho kiến trúc sư, kỹ sư xây dựng, kỹ sư cơ khí và nghệ sĩ 3D để thiết kế, mô phỏng và kiến tạo thế giới thực.`,
    common_features: [
      'Trọn bộ phần mềm Autodesk: AutoCAD, Revit, 3ds Max, Maya, Inventor',
      'Kích hoạt bản quyền chính hãng theo tài khoản',
      'Hỗ trợ cài đặt phiên bản mới nhất trên máy tính',
      'Lưu trữ đám mây Autodesk Cloud'
    ],
    plans: [
      {
        name_match: '3 năm (BH 1 năm)',
        duration_match: '1095 ngày',
        badge: 'Gói 3 Năm',
        warranty: '1 năm',
        is_highlight: true,
        plan_features: [
          'Thời hạn bản quyền hiển thị 3 năm',
          'Đầy đủ tất cả phần mềm Autodesk',
          'Chính sách bảo hành kỹ thuật 1 năm',
          'Hỗ trợ kích hoạt nhanh chóng'
        ]
      }
    ]
  },

  // 18. Memrise Pro
  {
    slug: 'memrise-pro',
    name: 'Memrise Pro',
    short_description: 'Ứng dụng học ngoại ngữ thông minh với video người bản xứ thực tế và phương pháp lặp lại ngắt quãng (SRS).',
    description: `### 🌍 Học ngoại ngữ tự nhiên và ghi nhớ lâu dài cùng Memrise Pro
Memrise Pro giúp bạn làm chủ hàng chục ngôn ngữ thông qua các bài học tương tác sống động, hàng ngàn video ngắn quay người bản xứ trong đời thực và công cụ luyện đàm thoại AI MemBot thông minh.`,
    common_features: [
      'Mở khóa tất cả bài học và ngôn ngữ trên Memrise',
      'Học qua hàng ngàn video hội thoại thực tế của người bản xứ',
      'Luyện nói và phản xạ giao tiếp cùng MemBot AI',
      'Học ngoại tuyến mọi lúc mọi nơi không cần mạng'
    ],
    plans: [
      {
        name_match: 'Lifetime 20 năm (BH 1 tháng)',
        duration_match: '7300 ngày',
        badge: 'Lifetime 20 Năm',
        warranty: '1 tháng',
        is_highlight: true,
        plan_features: [
          'Thời hạn bản quyền 20 năm',
          'Mở khóa toàn bộ tính năng Pro',
          'Bảo hành kỹ thuật 1 tháng',
          'Học không giới hạn ngôn ngữ'
        ]
      }
    ]
  },

  // 19. iCloud+ Apple Storage
  {
    slug: 'iclou-storage',
    name: 'iCloud+ Apple Storage',
    short_description: 'Không gian lưu trữ đám mây cho hệ sinh thái Apple: iPhone, iPad, Mac sao lưu ảnh gốc và dữ liệu an toàn.',
    description: `### 🍏 Mở rộng dung lượng lưu trữ hoàn hảo cho thiết bị Apple
iCloud+ giúp bạn không còn nỗi lo đầy bộ nhớ iPhone/iPad, tự động sao lưu ảnh chất lượng gốc, danh bạ, tin nhắn và bảo vệ quyền riêng tư với tính năng iCloud Private Relay và Hide My Email.`,
    common_features: [
      'Lưu trữ hình ảnh, video chất lượng gốc và tài liệu an toàn',
      'Tự động sao lưu thiết bị iPhone, iPad, MacBook',
      'Bảo vệ quyền riêng tư duyệt web với iCloud Private Relay',
      'Tính năng Hide My Email (Ẩn địa chỉ email)',
      'Gia nhập Family an toàn, dữ liệu cá nhân hoàn toàn bảo mật riêng tư'
    ],
    plans: [
      {
        name_match: 'Slot 2TB (1 tháng)',
        duration_match: '30 ngày',
        badge: '2TB Khủng',
        warranty: 'Full thời gian',
        is_highlight: true,
        plan_features: [
          'Dung lượng 2.000GB (2TB) tốc độ cao',
          'Thời hạn 30 ngày',
          'Gia nhập nhóm Apple Family chính chủ',
          'Bảo hành Full thời gian'
        ]
      },
      {
        name_match: 'Slot 400GB (1 năm)',
        duration_match: '365 ngày',
        badge: '400GB 1 Năm',
        warranty: 'Full thời gian',
        is_highlight: false,
        plan_features: [
          'Dung lượng 400GB',
          'Thời hạn trọn vẹn 1 năm (365 ngày)',
          'Ổn định lâu dài không cần gia hạn hàng tháng',
          'Bảo hành trọn năm'
        ]
      }
    ]
  },

  // 20. ChatGPT Plus / Team Business
  {
    slug: 'chatgpt-plus',
    name: 'ChatGPT Plus',
    short_description: 'Trợ lý AI số 1 thế giới với mô hình GPT-4o, OpenAI o1, Canvas, tạo ảnh DALL-E 3 và Voice Mode tương tác trực tiếp.',
    description: `### 🧠 Trải nghiệm trí tuệ nhân tạo mạnh mẽ nhất cùng ChatGPT
ChatGPT là trợ lý AI toàn năng giúp bạn giải quyết mọi tác vụ từ viết lách, dịch thuật, lập trình, phân tích dữ liệu chuyên sâu đến trò chuyện giọng nói tự nhiên với Advanced Voice Mode.`,
    common_features: [
      'Quyền truy cập các mô hình AI mới nhất: GPT-4o, OpenAI o1, Canvas',
      'Tạo ảnh nghệ thuật chất lượng cao với DALL-E 3',
      'Tải file dữ liệu, hình ảnh, tài liệu để phân tích thông minh',
      'Tương tác giọng nói thời gian thực Advanced Voice Mode',
      'Tạo và sử dụng kho GPTs tùy chỉnh đa dạng'
    ],
    plans: [
      {
        name_match: 'ChatGPT Team Business 1 tháng',
        duration_match: '30 ngày',
        badge: 'Team Business',
        warranty: 'Full thời gian',
        is_highlight: true,
        plan_features: [
          'Gói Team Business tốc độ cao',
          'Hạn mức nhắn tin cao gấp đôi gói Plus thông thường',
          'Thời hạn 30 ngày liên tục',
          'Bảo hành 1 đổi 1 suốt 30 ngày'
        ]
      }
    ]
  },

  // 21. Super Duolingo
  {
    slug: 'super-duolingo',
    name: 'Super Duolingo',
    short_description: 'Học ngoại ngữ không giới hạn trái tim, không quảng cáo và mở khóa chế độ luyện tập chuyên sâu.',
    description: `### 🦉 Chinh phục ngoại ngữ vui nhộn và hiệu quả cùng Super Duolingo
Super Duolingo nâng tầm hành trình học ngoại ngữ của bạn với trải nghiệm mượt mà không quảng cáo, trái tim vô hạn để bạn thoải mái luyện tập mà không sợ bị ngắt quãng, kèm theo các bài kiểm tra kỹ năng cá nhân hóa.`,
    common_features: [
      'Trái tim không giới hạn (Unlimited Hearts) — học tập không lo gián đoạn',
      'Xóa sạch 100% quảng cáo',
      'Luyện tập cá nhân hóa khắc phục lỗi sai (Mistakes Review)',
      'Bài kiểm tra kỹ năng tiến độ không giới hạn',
      'Nâng cấp trực tiếp trên chính tài khoản Duolingo của bạn'
    ],
    plans: [
      {
        name_match: 'Nâng chính chủ 1 năm',
        duration_match: '365 ngày',
        badge: 'Chính chủ 1 Năm',
        warranty: 'Full thời gian',
        is_highlight: true,
        plan_features: [
          'Nâng cấp chính chủ email Duolingo của bạn',
          'Thời hạn sử dụng 1 năm (365 ngày)',
          'Giữ nguyên toàn bộ tiến độ và streak học',
          'Bảo hành uy tín trọn năm'
        ]
      }
    ]
  },

  // 22. NOTION
  {
    slug: 'notion',
    name: 'NOTION',
    short_description: 'Không gian làm việc tất cả trong một: Quản lý dự án, ghi chú, cơ sở dữ liệu và tích hợp Notion AI.',
    description: `### 📓 Tổ chức công việc và cuộc sống thông minh với Notion Business
Notion là nền tảng quản lý công việc và kiến thức số 1 thế giới, cho phép bạn xây dựng hệ thống quản lý dự án linh hoạt, bảng tính database nâng cao và lưu trữ tài liệu nhóm không giới hạn dung lượng.`,
    common_features: [
      'Không gian làm việc không giới hạn block và dung lượng upload',
      'Cơ sở dữ liệu nâng cao: Table, Board, Calendar, Timeline, Gallery',
      'Lịch sử phiên bản trang (Page History) chi tiết',
      'Phân quyền cộng tác nhóm chuyên nghiệp',
      'Tích hợp hàng trăm công cụ như Slack, GitHub, Google Drive'
    ],
    plans: [
      {
        name_match: 'Notion Business 6 tháng',
        duration_match: '180 ngày',
        badge: 'Business 6T',
        warranty: 'Full thời gian',
        is_highlight: true,
        plan_features: [
          'Quyền lợi Notion Business 180 ngày',
          'Upload tệp không giới hạn kích thước',
          'Không giới hạn thành viên cộng tác',
          'Bảo hành Full 6 tháng'
        ]
      }
    ]
  },

  // 23. Cursor Pro
  {
    slug: 'cursor-pro',
    name: 'Cursor Pro',
    short_description: 'Trình biên tập mã nguồn AI thế hệ mới (AI Code Editor) viết code, gỡ lỗi và refactor siêu tốc.',
    description: `### 💻 Trình soạn thảo mã nguồn tích hợp AI đỉnh cao cho Coder
Cursor được xây dựng trên nền tảng VS Code nhưng tích hợp sâu trí tuệ nhân tạo, cho phép bạn tạo dự án mới từ ý tưởng, chat trực tiếp với toàn bộ codebase (Codebase Indexing) và sửa lỗi tự động chỉ với 1 phím tắt.`,
    common_features: [
      'Gợi ý code thông minh theo thời gian thực (Cursor Tab)',
      'Chat và tương tác trực tiếp với toàn bộ thư mục dự án (Codebase indexing)',
      'Tự động áp dụng thay đổi trên nhiều file cùng lúc',
      'Hỗ trợ các mô hình AI lập trình mạnh nhất hiện nay'
    ],
    plans: [
      {
        name_match: 'API 2.600 Credit (1 tháng)',
        duration_match: '30 ngày',
        badge: '2600 Credit',
        warranty: 'Full thời gian',
        is_highlight: false,
        plan_features: [
          '2.600 Credit sử dụng trong 30 ngày',
          'Tốc độ phản hồi ưu tiên (Fast Requests)',
          'Bảo hành Full thời gian'
        ]
      },
      {
        name_match: 'API 6.500 Credit (1 tháng)',
        duration_match: '30 ngày',
        badge: '6500 Credit',
        warranty: 'Full thời gian',
        is_highlight: true,
        plan_features: [
          '6.500 Credit sử dụng trong 30 ngày',
          'Dành cho lập trình viên làm việc cường độ cao',
          'Bảo hành Full thời gian'
        ]
      }
    ]
  },

  // 24. Spotify Premium
  {
    slug: 'spotify-premium',
    name: 'Spotify Premium',
    short_description: 'Thưởng thức hơn 100M+ bài hát và podcast chất lượng 320kbps, không quảng cáo, nghe ngoại tuyến.',
    description: `### 🎧 Đắm chìm trong thế giới âm nhạc bất tận cùng Spotify Premium
Spotify Premium là dịch vụ phát trực tuyến âm nhạc phổ biến nhất hành tinh, mang đến kho nhạc khổng lồ với chất lượng âm thanh cao cấp, thuật toán gợi ý bài hát thông minh vượt trội và khả năng nghe nhạc offline mọi lúc mọi nơi.`,
    common_features: [
      'Nghe nhạc hoàn toàn không có quảng cáo',
      'Chất lượng âm thanh cao nhất 320kbps cực nét',
      'Tải nhạc và podcast về máy để nghe ngoại tuyến không cần mạng',
      'Chuyển bài không giới hạn và phát bài hát theo thứ tự tùy thích',
      'Nâng cấp chính chủ trên chính email Spotify của bạn'
    ],
    plans: [
      {
        name_match: 'Nâng chính chủ 1 tháng',
        duration_match: '30 ngày',
        badge: '1 Tháng',
        warranty: 'Full thời gian',
        is_highlight: false,
        plan_features: [
          'Nâng cấp chính chủ 30 ngày',
          'Nghe nhạc 320kbps không quảng cáo',
          'Bảo hành Full 30 ngày'
        ]
      },
      {
        name_match: 'Nâng chính chủ 3 tháng',
        duration_match: '90 ngày',
        badge: '3 Tháng',
        warranty: 'Full thời gian',
        is_highlight: false,
        plan_features: [
          'Nâng cấp chính chủ 90 ngày',
          'Trải nghiệm liền mạch không gián đoạn',
          'Bảo hành Full 90 ngày'
        ]
      },
      {
        name_match: 'Nâng chính chủ 6 tháng',
        duration_match: '180 ngày',
        badge: '6 Tháng',
        warranty: 'Full thời gian',
        is_highlight: true,
        plan_features: [
          'Thời hạn 180 ngày bền vững',
          'Tiết kiệm chi phí đáng kể',
          'Bảo hành chu đáo 6 tháng'
        ]
      },
      {
        name_match: 'Nâng chính chủ 1 năm',
        duration_match: '365 ngày',
        badge: 'Gói 1 Năm',
        warranty: 'Full thời gian',
        is_highlight: false,
        plan_features: [
          'Trọn vẹn 365 ngày (1 năm)',
          'Tiết kiệm tối đa, nghe nhạc thả ga',
          'Bảo hành uy tín trọn năm'
        ]
      }
    ]
  },

  // 25. Figma Pro
  {
    slug: 'figma-pro',
    name: 'Figma Pro',
    short_description: 'Công cụ thiết kế UI/UX và tạo mẫu tương tác (Prototyping) cộng tác thời gian thực số 1 thế giới.',
    description: `### 🎨 Tiêu chuẩn thiết kế giao diện sản phẩm công nghệ Figma Pro
Figma là nền tảng thiết kế giao diện người dùng và trải nghiệm người dùng (UI/UX) hàng đầu trong ngành công nghệ, cho phép các nhóm thiết kế, lập trình viên và quản lý sản phẩm cùng cộng tác trong thời gian thực trên cùng một tệp thiết kế.`,
    common_features: [
      'Không giới hạn tệp thiết kế và dự án trong Team',
      'Lịch sử phiên bản tệp không giới hạn',
      'Thư viện thành phần (Design System / Component Library) dùng chung',
      'Chế độ Dev Mode hỗ trợ lập trình viên đo đạc và xuất mã nguồn',
      'Tạo mẫu tương tác (Interactive Prototyping) mượt mà'
    ],
    plans: [
      {
        name_match: '1 năm',
        duration_match: '365 ngày',
        badge: 'Gói 1 Năm',
        warranty: 'Full thời gian',
        is_highlight: true,
        plan_features: [
          'Thời hạn sử dụng 1 năm (365 ngày)',
          'Đầy đủ quyền năng Figma Pro và Dev Mode',
          'Nâng cấp chính chủ an toàn',
          'Bảo hành trọn vẹn 1 năm'
        ]
      }
    ]
  },

  // 26. Proton Unlimited
  {
    slug: 'proton-unlimited',
    name: 'Proton Unlimited',
    short_description: 'Bộ công cụ bảo mật & quyền riêng tư chuẩn Thụy Sĩ: Proton Mail, Proton VPN, Proton Drive, Proton Pass.',
    description: `### 🛡️ Bảo vệ quyền riêng tư tuyệt đối chuẩn Thụy Sĩ cùng Proton Unlimited
Proton Unlimited tích hợp toàn bộ các dịch vụ bảo mật cao cấp nhất của Proton, được mã hóa đầu cuối (End-to-End Encryption) và bảo vệ nghiêm ngặt theo luật pháp bảo mật dữ liệu của Thụy Sĩ.`,
    common_features: [
      '500GB dung lượng lưu trữ đám mây mã hóa an toàn',
      'Proton Mail mã hóa đầu cuối với tối đa 15 địa chỉ email',
      'Proton VPN tốc độ cao nhất với hơn 6.500+ máy chủ toàn cầu',
      'Trình quản lý mật khẩu an toàn Proton Pass',
      'Proton Calendar lịch cá nhân bảo mật tuyệt đối'
    ],
    plans: [
      {
        name_match: '1 tháng',
        duration_match: '30 ngày',
        badge: 'Proton 1 Tháng',
        warranty: 'Full thời gian',
        is_highlight: true,
        plan_features: [
          'Thời lượng sử dụng 30 ngày',
          'Đầy đủ Proton Mail, VPN, Drive, Pass',
          'Mã hóa đầu cuối chuẩn Thụy Sĩ',
          'Bảo hành Full thời gian sử dụng'
        ]
      }
    ]
  }
];

async function dryRunContentSync() {
  console.log('================================================================');
  console.log('🔍 DRY RUN: DATA CONTENT & FEATURES SYNC');
  console.log('   (IMMUTABLE RULE: NO PRICE MODIFICATION)');
  console.log('================================================================\n');

  const { data: currentProducts } = await adminDb.from('products').select('id, name, slug, base_price, cost_price, price_ctv');
  const { data: currentPlans } = await adminDb.from('product_plans').select('id, product_id, name, duration, price, cost_price, price_ctv, notes, badge, is_highlight, features');
  const { data: currentFeatures } = await adminDb.from('product_features').select('*');

  console.log(`Auditing ${contentSpecs.length} product specs against existing database...\n`);

  let auditedProducts = 0;
  let auditedPlans = 0;

  for (const spec of contentSpecs) {
    const prod = currentProducts?.find(p => p.slug === spec.slug);
    if (!prod) {
      console.warn(`⚠️ Product not found in DB: [${spec.name}] (${spec.slug})`);
      continue;
    }

    auditedProducts++;
    console.log(`📦 [${prod.name}] (${prod.slug})`);
    console.log(`   💰 Product Prices: Retail=${prod.base_price}đ | Cost=${prod.cost_price}đ | CTV=${prod.price_ctv}đ (PRICE IMMUTABLE ✅)`);
    console.log(`   📝 Proposed Common Features (${spec.common_features.length}):`, spec.common_features);

    for (const planSpec of spec.plans) {
      const plan = currentPlans?.find(pl => 
        pl.product_id === prod.id && (
          pl.name.trim().toLowerCase() === planSpec.name_match.trim().toLowerCase() ||
          pl.duration.trim().toLowerCase() === (planSpec.duration_match || '').trim().toLowerCase()
        )
      );

      if (plan) {
        auditedPlans++;
        console.log(`     ✓ Plan [${plan.name}] (${plan.duration})`);
        console.log(`       Price: Retail=${plan.price}đ | Cost=${plan.cost_price}đ | CTV=${plan.price_ctv}đ (PRICE IMMUTABLE ✅)`);
        console.log(`       Badge: "${planSpec.badge || ''}" | Warranty: "${planSpec.warranty}" | Highlight: ${!!planSpec.is_highlight}`);
        console.log(`       Specific Features (${planSpec.plan_features.length}):`, planSpec.plan_features);
      } else {
        console.warn(`     ⚠️ Plan not found for matching: "${planSpec.name_match}"`);
      }
    }
  }

  console.log(`\n================================================================`);
  console.log(`🎉 DRY RUN COMPLETED: ${auditedProducts} Products & ${auditedPlans} Plans validated.`);
  console.log(`================================================================`);
}

dryRunContentSync().catch(console.error);
