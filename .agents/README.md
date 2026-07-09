# `.agents/` — Không gian làm việc cho AI Agent

Thư mục này **không chứa code runtime**. Dùng để agent (và dev) lưu ngữ cảnh, rule phụ, plan.

| Thư mục | Mục đích |
|---|---|
| `rules/` | Rule module / checklist bổ sung ngoài `AGENTS.md` gốc |
| `context/` | Overview domain, glossary, tài khoản demo |
| `plans/` | Plan feature tạm (có thể xóa sau khi merge) |

## Thứ tự đọc khi agent vào task

1. `/AGENTS.md` — tech stack, theme, UI rules  
2. `/docs/directory-structure.md` — map thư mục  
3. `.agents/context/project-overview.md` — domain nghiệp vụ  
4. Code liên quan theo map (components / services / types)  

## Không làm

- Không import file trong `.agents/` vào Next.js app  
- Không commit secret / mật khẩu production vào đây  
