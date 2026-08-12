import type { Language } from '../language'

// 로그인/회원가입 화면 전체(AuthLayout, LoginForm/SignupForm, SocialLoginButtons,
// LoginPage/SignupPage) + lib/validation.ts가 돌려주는 에러 메시지 키.
export const authDictionary: Record<Language, Record<string, string>> = {
  ko: {
    loginTitle: '로그인',
    loginSubtitle: '다시 만나서 반가워요. 이메일로 로그인해주세요.',
    loginFooterText: '아직 계정이 없으신가요?',
    loginFooterLink: '회원가입',
    loginInvalidCredentials: '이메일 또는 비밀번호가 올바르지 않아요.',

    signupTitle: '회원가입',
    signupSubtitle: '1분이면 가입 완료. AI 여행 일정을 무료로 만들어보세요.',
    signupFooterText: '이미 계정이 있으신가요?',
    signupFooterLink: '로그인',
    signupEmailTaken: '이미 가입된 이메일이에요. 로그인해주세요.',

    orDivider: '또는',

    emailLabel: '이메일',
    passwordLabel: '비밀번호',
    passwordConfirmLabel: '비밀번호 확인',
    loginSubmit: '로그인',
    signupSubmit: '회원가입',

    googleContinue: 'Google로 계속하기',
    kakaoContinue: 'Kakao로 계속하기',

    errorEmailRequired: '이메일을 입력해주세요.',
    errorEmailInvalid: '올바른 이메일 형식이 아니에요.',
    errorPasswordRequired: '비밀번호를 입력해주세요.',
    errorPasswordTooShort: '비밀번호는 8자 이상이어야 해요.',
    errorPasswordMismatch: '비밀번호가 일치하지 않아요.',
    errorEmailTaken: '이미 가입된 이메일이에요.',
  },
  en: {
    loginTitle: 'Log In',
    loginSubtitle: 'Welcome back. Please log in with your email.',
    loginFooterText: "Don't have an account?",
    loginFooterLink: 'Sign up',
    loginInvalidCredentials: 'Incorrect email or password.',

    signupTitle: 'Sign Up',
    signupSubtitle: 'Sign up in a minute — create your free AI trip plan.',
    signupFooterText: 'Already have an account?',
    signupFooterLink: 'Log in',
    signupEmailTaken: 'This email is already registered. Please log in.',

    orDivider: 'or',

    emailLabel: 'Email',
    passwordLabel: 'Password',
    passwordConfirmLabel: 'Confirm password',
    loginSubmit: 'Log in',
    signupSubmit: 'Sign up',

    googleContinue: 'Continue with Google',
    kakaoContinue: 'Continue with Kakao',

    errorEmailRequired: 'Please enter your email.',
    errorEmailInvalid: 'That doesn’t look like a valid email.',
    errorPasswordRequired: 'Please enter your password.',
    errorPasswordTooShort: 'Password must be at least 8 characters.',
    errorPasswordMismatch: 'Passwords do not match.',
    errorEmailTaken: 'This email is already registered.',
  },
  ja: {
    loginTitle: 'ログイン',
    loginSubtitle: 'おかえりなさい。メールアドレスでログインしてください。',
    loginFooterText: 'アカウントをお持ちでないですか?',
    loginFooterLink: '新規登録',
    loginInvalidCredentials: 'メールアドレスまたはパスワードが正しくありません。',

    signupTitle: '新規登録',
    signupSubtitle: '1分で登録完了。AI旅行プランを無料で作成しましょう。',
    signupFooterText: 'すでにアカウントをお持ちですか?',
    signupFooterLink: 'ログイン',
    signupEmailTaken: 'すでに登録済みのメールアドレスです。ログインしてください。',

    orDivider: 'または',

    emailLabel: 'メールアドレス',
    passwordLabel: 'パスワード',
    passwordConfirmLabel: 'パスワード確認',
    loginSubmit: 'ログイン',
    signupSubmit: '新規登録',

    googleContinue: 'Googleで続ける',
    kakaoContinue: 'Kakaoで続ける',

    errorEmailRequired: 'メールアドレスを入力してください。',
    errorEmailInvalid: 'メールアドレスの形式が正しくありません。',
    errorPasswordRequired: 'パスワードを入力してください。',
    errorPasswordTooShort: 'パスワードは8文字以上で入力してください。',
    errorPasswordMismatch: 'パスワードが一致しません。',
    errorEmailTaken: 'すでに登録済みのメールアドレスです。',
  },
}
