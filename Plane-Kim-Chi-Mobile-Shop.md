# Kế Hoạch MVP Kim Chi Mobile Shop

## 1. Tóm tắt

Kim Chi Mobile Shop cần một web quản lý nội bộ cho 3 cửa hàng điện thoại. Bản MVP tập trung vào 4 nhóm nghiệp vụ chính: kho hàng, sửa chữa, thu chi và dashboard tổng quan.

Giai đoạn hiện tại chỉ xây dựng giao diện frontend để duyệt UI/UX và luồng nghiệp vụ. Sau khi giao diện ổn, backend và database sẽ phát triển tiếp bằng Supabase.

## 2. Công nghệ

- Frontend: Next.js App Router.
- Ngôn ngữ: TypeScript.
- UI/UX framework: Tailwind CSS, kết hợp bộ component tự xây theo phong cách dashboard vận hành.
- Icon: lucide-react.
- Database giai đoạn sau: Supabase.
- Giai đoạn hiện tại: dùng dữ liệu mock trong frontend, chưa kết nối backend, chưa ghi database thật.

## 3. Phạm vi MVP

### Tài khoản và phân quyền

- Có 2 vai trò: Chủ cửa hàng và Nhân viên.
- Chủ cửa hàng có toàn quyền: quản lý tài khoản, hủy mềm dữ liệu/giao dịch và xem toàn bộ báo cáo.
- Nhân viên được thêm/sửa nghiệp vụ hằng ngày, nhưng không được hủy dữ liệu quan trọng.
- Mọi thao tác thêm, sửa, hủy phải ghi nhật ký gồm người thao tác, thời gian, cửa hàng, loại thao tác và dữ liệu liên quan.

### Kho hàng

- Quản lý tồn kho tách riêng cho Cửa hàng 1, Cửa hàng 2 và Cửa hàng 3.
- Máy cũ quản lý theo IMEI, gồm: tên máy, IMEI, màu, dung lượng, tình trạng, giá nhập, giá bán dự kiến, cửa hàng và trạng thái.
- Phụ kiện quản lý theo mã/tên hàng và số lượng, không cần IMEI.
- Dữ liệu quan trọng không xóa vĩnh viễn; chỉ chuyển sang trạng thái hủy/ẩn.

### Bán hàng

- Có phiếu bán đơn giản.
- Phiếu bán có thể bán máy theo IMEI hoặc phụ kiện theo số lượng.
- Mỗi phiếu bán ghi khách hàng, cửa hàng, người tạo, phương thức thanh toán, giá bán và lãi/giá vốn nếu cần.
- Khi tạo phiếu bán, hệ thống tự cập nhật tồn kho, tạo dòng thu và ghi log.

### Khách hàng

- Lưu hồ sơ khách hàng dùng chung cho bán hàng và sửa chữa.
- Thông tin tối thiểu gồm tên và số điện thoại.
- Có thể tra cứu lịch sử giao dịch theo khách hàng trong các phiếu liên quan.

### Sửa chữa

- Có phiếu nhận máy sửa chữa.
- Phiếu sửa gồm khách hàng, tên máy, mật khẩu màn hình dạng ghi chú thường, tình trạng lúc nhận, lỗi cần sửa, báo giá, tiền cọc, cửa hàng và trạng thái.
- Trạng thái sửa chữa: Đang chờ, Đang sửa, Đã xong, Đã trả khách, Đã hủy.
- Khi thu tiền sửa chữa hoặc tiền cọc, hệ thống tạo dòng thu tương ứng.
- Mật khẩu màn hình được lưu dạng ghi chú thường trong MVP; đây là rủi ro bảo mật cần được chủ cửa hàng chấp nhận.

### Thu chi

- Sổ thu chi quản lý theo từng giao dịch.
- Phiếu bán, phiếu sửa, nhập hàng và chi thủ công đều tạo dòng thu/chi có cửa hàng, người tạo và phương thức thanh toán.
- Phương thức thanh toán cơ bản: Tiền mặt, Chuyển khoản, Thẻ, Khác.
- Giao dịch sai được hủy mềm, không xóa khỏi hệ thống.

### Dashboard

- Hiển thị tổng quan vận hành: tổng máy tồn kho, tổng phụ kiện tồn, tổng vốn, tổng lãi, tổng thu, tổng chi và số máy đang sửa.
- Có bộ lọc theo toàn hệ thống hoặc từng cửa hàng.
- Giai đoạn frontend hiển thị từ dữ liệu mock; giai đoạn backend sẽ tính từ Supabase.

## 4. Màn hình chính

- Đăng nhập demo.
- Dashboard.
- Kho hàng.
- Tạo phiếu bán.
- Khách hàng.
- Sửa chữa.
- Thu chi.
- Nhật ký thao tác.
- Quản lý tài khoản cho Chủ cửa hàng.

## 5. Ngoài phạm vi MVP

- Import Excel.
- POS đầy đủ.
- Tích điểm.
- Quét mã vạch chuyên sâu.
- Bảo hành đầy đủ.
- Đối soát ngân hàng/cuối ca nâng cao.
- Phân quyền phức tạp hơn vai trò Chủ cửa hàng/Nhân viên.

## 6. Tiêu chí hoàn thành frontend

- Có giao diện đăng nhập demo cho Chủ cửa hàng và Nhân viên.
- Dashboard hiển thị đúng các chỉ số mock và lọc được theo cửa hàng.
- Kho hàng có tab máy cũ/phụ kiện, tìm kiếm và lọc theo cửa hàng.
- Phiếu bán mô phỏng được bán máy/phụ kiện, cập nhật tồn kho, tạo dòng thu và ghi log trong state frontend.
- Phiếu sửa mô phỏng được tạo phiếu, ghi tiền cọc và cập nhật trạng thái.
- Thu chi tạo được khoản thu/chi thủ công.
- Nhật ký thao tác hiển thị các hành động chính.
- Quản lý tài khoản chỉ mở cho vai trò Chủ cửa hàng.

## 7. Giai đoạn sau

- Thiết kế schema Supabase cho các thực thể: stores, users, customers, phones, accessories, sales, repairs, ledger_entries, audit_logs.
- Thêm authentication thật và phân quyền theo role.
- Chuyển mock state sang Supabase query/mutation.
- Bổ sung validation, optimistic update, error state và loading state.
- Hoàn thiện hủy mềm ở database bằng trường status hoặc deleted_at.
