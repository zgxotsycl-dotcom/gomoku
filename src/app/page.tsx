import { redirect } from 'next/navigation'
import { fallbackLng } from '@/i18n/settings'

export default function RootRedirect() {
  // 루트 접근 시 기본 언어로 리다이렉트
  redirect(`/${fallbackLng}/scroll-demo`)
}


