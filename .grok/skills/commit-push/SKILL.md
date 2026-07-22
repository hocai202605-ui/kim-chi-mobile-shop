---
name: commit-push
description: >
  Stage all changed/new files, create a Vietnamese commit message summarizing the update,
  commit, and push to the remote tracking branch. Use when the user asks to commit, push,
  "đẩy code", "commit và push", "cập nhật git", or runs /commit-push.
---

# Commit + Push (tiếng Việt)

Quy trình bắt buộc khi user muốn lưu và đẩy code lên git.

## Mục tiêu

1. `git add` mọi file **đã sửa / thêm mới** (và xóa đã tracked nếu có).
2. Commit với **message tiếng Việt**, tóm tắt nội dung update.
3. `git push` lên remote branch hiện tại.

## Bước thực hiện

### 1. Kiểm tra trạng thái

Chạy song song (hoặc tuần tự nếu shell hạn chế):

```bash
git status
git diff
git diff --staged
git log -5 --oneline
git branch -vv
```

- Nếu **không có thay đổi** (working tree clean, không staged): báo user và **dừng** — không commit rỗng, không push.
- Đọc diff để viết message chính xác; không bịa nội dung không có trong diff.

### 2. An toàn — không commit secrets

**Không** add / commit:

- `.env`, `.env.*` (trừ `.env.example` nếu repo đã track cố ý)
- Key, credential, token, file chứa private
- `node_modules/`, build artifact lạ ngoài quy ước repo

Nếu thấy file nhạy cảm trong untracked/modified: **bỏ qua** file đó, cảnh báo user, tiếp tục với phần còn lại.

### 3. Stage

```bash
git add -A
```

Sau đó `git status` lại để xác nhận staged đúng.

- Nếu user chỉ định path cụ thể: chỉ `git add <paths>` những path đó.
- Mặc định (user không chỉ path): stage **toàn bộ** thay đổi hợp lệ trong repo.

### 4. Message commit (tiếng Việt)

Viết 1–2 câu, **tiếng Việt**, focus vào *vì sao / làm gì*, không liệt kê file máy móc.

**Form khuyến nghị:**

```
<Hành động ngắn>: <mô tả thay đổi chính>

<Tuỳ chọn: 1 dòng chi tiết thêm nếu cần>
```

Ví dụ:

- `Sửa công nợ: chọn nhiều dòng, thu nợ có action, số nợ theo doanh thu`
- `Cập nhật menu Công nợ: bật thu nợ repair/sale và join store phần mềm`
- `Thêm skill commit-push để agent add, commit tiếng Việt và push`

Quy tắc:

- Dùng tiếng Việt có dấu, rõ ràng.
- Có thể prefix loại: `Sửa:`, `Thêm:`, `Cập nhật:`, `Refactor:`, `Xóa:`.
- Không dùng message generic kiểu `update`, `fix`, `wip`.
- Phong cách gần các commit gần đây trong `git log` nếu repo đã có convention.

**Windows / PowerShell:** tránh HEREDOC bash. Dùng:

```powershell
git commit -m "Message tiếng Việt một dòng"
```

Hoặc nhiều đoạn:

```powershell
git commit -m "Tiêu đề ngắn" -m "Chi tiết thêm nếu cần"
```

### 5. Commit

Chạy commit với message đã soạn.

- Nếu `git commit` fail vì hook / empty: đọc lỗi, sửa hoặc báo user — **không** `--no-verify` trừ khi user yêu cầu rõ.
- Sau commit: `git status` xác nhận clean (hoặc chỉ còn untracked cố ý bỏ).

### 6. Push

```bash
git push
```

- Branch đã có upstream: `git push` là đủ.
- Branch mới / chưa set upstream:

```bash
git push -u origin HEAD
```

- **Cấm** trừ khi user nói rõ: `git push --force`, `git push --force-with-lease`, amend commit đã push.
- Push fail (auth, network, non-fast-forward): báo nguyên nhân + gợi ý (`git pull --rebase` rồi push lại nếu phù hợp) — không force.

### 7. Báo cáo user

Trả lời ngắn:

- Message commit đã dùng
- Hash ngắn (`git rev-parse --short HEAD`) nếu có
- Branch + remote (vd. `main → origin/main`)
- Số file / tóm tắt 1 dòng nếu hữu ích

## Khi user nói gì thì chạy skill này

- `/commit-push`
- "commit và push", "đẩy lên git", "push giúp", "commit giúp rồi push"
- "add file rồi commit push"
- Sau khi xong task và user bảo "cập nhật git" / "lưu lên git"

## Không làm

- Không đổi `git config`
- Không tạo PR trừ khi user hỏi riêng
- Không commit khi không có diff
- Không push force / xóa remote branch
- Không commit file secret

## Checklist nhanh

- [ ] `git status` / diff đã xem
- [ ] Không stage secrets
- [ ] `git add` đủ file đổi / thêm
- [ ] Message tiếng Việt, mô tả đúng update
- [ ] `git commit` thành công
- [ ] `git push` (hoặc `-u origin HEAD` nếu branch mới)
- [ ] Báo user kết quả
