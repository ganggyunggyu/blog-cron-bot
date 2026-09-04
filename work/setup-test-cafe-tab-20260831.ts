import dotenv from 'dotenv';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

dotenv.config();

const SHEET_ID = '1T9PHu-fH6HPmyYA9dtfXaDLm20XAPN-9mzlE2QTPkF0';
const TAB_TITLE = '테스트카페키워드';

const KEYWORDS = ['강아지 눈 영양제', '부평웨딩홀', '완전존재하지않는랜덤키워드테스트12345'];

const main = async () => {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  const key = process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n');
  const auth = new JWT({ email, key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const doc = new GoogleSpreadsheet(SHEET_ID, auth);
  await doc.loadInfo();

  let sheet = doc.sheetsByTitle[TAB_TITLE];
  if (sheet) {
    console.log('기존 탭 있음, 삭제 후 재생성:', sheet.sheetId);
    await sheet.delete();
  }
  sheet = await doc.addSheet({ title: TAB_TITLE, headerValues: ['키워드'] });
  await sheet.addRows(KEYWORDS.map((k) => ({ 키워드: k })));
  console.log('탭 생성 완료:', sheet.title, sheet.sheetId, 'rows:', KEYWORDS.length);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
