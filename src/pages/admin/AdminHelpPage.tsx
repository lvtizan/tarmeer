const steps = [
  {
    title: '1) 登录后台',
    desc: '访问 /admin/login，使用管理员账号登录。若提示 session 失效，重新登录即可。',
  },
  {
    title: '2) 审核公司申请',
    desc: '进入 Companies 页面，切换到 Applications。通过后会进入 Companies 列表并可设置展示顺序。',
  },
  {
    title: '3) 设置展示顺序',
    desc: '在 Companies 和 Directory 都可填写 Order。数字越大越靠前，且全局不可重复。',
  },
  {
    title: '4) 查看线索',
    desc: 'Inquiries 为咨询线索，Complaints 为投诉举报。可在详情里更新处理状态。',
  },
];

const faq = [
  {
    q: 'Users 和 Companies 的区别是什么？',
    a: 'Users 是登录账号；Companies 是公司业务实体（审核、目录、申请、排序）。',
  },
  {
    q: '为什么有时看到 500？',
    a: '本地一般是前后端启动顺序或代理问题。先确认 3002 接口，再确认 5173 代理。',
  },
  {
    q: '图片加载失败怎么排查？',
    a: '先查接口返回的 URL，再查前端是否走 resolveImageUrl()，最后查静态文件与路由。',
  },
  {
    q: '排序号怎么用？',
    a: '可混合号段（如 Companies 用 1000+，Directory 用 5000+），但两边不能重复。',
  },
];

export default function AdminHelpPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Help Center</h1>
        <p className="mt-1 text-sm text-stone-500">
          后台使用说明与标准操作流程。建议新同事先看“快速上手”。
        </p>
      </div>

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="text-base font-semibold text-stone-800">快速上手</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {steps.map((item) => (
            <div key={item.title} className="rounded-lg border border-stone-100 bg-stone-50 p-4">
              <p className="text-sm font-semibold text-stone-800">{item.title}</p>
              <p className="mt-1 text-sm text-stone-600 leading-6">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="text-base font-semibold text-stone-800">核心页面说明</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-stone-500">
                <th className="py-2 pr-4">菜单</th>
                <th className="py-2 pr-4">用途</th>
                <th className="py-2">常见操作</th>
              </tr>
            </thead>
            <tbody className="text-stone-700">
              <tr className="border-b border-stone-100">
                <td className="py-3 pr-4 font-medium">Users</td>
                <td className="py-3 pr-4">账号管理</td>
                <td className="py-3">查看资料、调整状态与角色</td>
              </tr>
              <tr className="border-b border-stone-100">
                <td className="py-3 pr-4 font-medium">Companies</td>
                <td className="py-3 pr-4">公司实体管理</td>
                <td className="py-3">审核、绑定、排序、查看公司详情</td>
              </tr>
              <tr className="border-b border-stone-100">
                <td className="py-3 pr-4 font-medium">Inquiries</td>
                <td className="py-3 pr-4">咨询线索</td>
                <td className="py-3">跟进状态、写管理备注、导出</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-medium">Complaints</td>
                <td className="py-3 pr-4">投诉举报</td>
                <td className="py-3">处理状态更新（pending/reviewing/resolved）</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="text-base font-semibold text-stone-800">常见问题</h2>
        <div className="mt-4 space-y-3">
          {faq.map((item) => (
            <div key={item.q} className="rounded-lg border border-stone-100 bg-stone-50 p-4">
              <p className="text-sm font-semibold text-stone-800">{item.q}</p>
              <p className="mt-1 text-sm text-stone-600 leading-6">{item.a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

