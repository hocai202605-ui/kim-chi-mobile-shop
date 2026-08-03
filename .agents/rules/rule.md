# Rule dữ liệu thật

Project đang dùng dữ liệu thật. Mọi thay đổi code, migration, script, seed, cleanup hoặc thao tác test phải đảm bảo không làm mất, ghi đè, hủy sai, nhân bản sai, đổi trạng thái sai, hoặc làm sai lệch dữ liệu cũ.

Trước khi sửa phần có ghi dữ liệu, phải kiểm tra luồng hiện tại và lên plan rõ ràng. Chỉ thực hiện khi đã được xác nhận. Ưu tiên thay đổi tương thích ngược, soft-delete, migration có kiểm soát, và tránh chạy script phá dữ liệu trên môi trường thật.
