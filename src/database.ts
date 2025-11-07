import mongoose, { Schema, Document } from 'mongoose';

export interface IKeyword extends Document {
  company: string;
  keyword: string;
  visibility: boolean;
  popularTopic: string;
  url: string;
  sheetType: string;
  lastChecked: Date;
  createdAt: Date;
  updatedAt: Date;
}

const KeywordSchema: Schema = new Schema(
  {
    company: { type: String, required: true },
    keyword: { type: String, required: true },
    visibility: { type: Boolean, default: false },
    popularTopic: { type: String, default: '' },
    url: { type: String, default: '' },
    sheetType: { type: String, default: 'package' },
    lastChecked: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

export const Keyword = mongoose.model<IKeyword>('Keyword', KeywordSchema);

export const connectDB = async (uri: string): Promise<void> => {
  try {
    await mongoose.connect(uri);
    console.log('✅ MongoDB 연결 성공');
  } catch (error) {
    console.error('❌ MongoDB 연결 실패:', error);
    throw error;
  }
};

export const disconnectDB = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    console.log('✅ MongoDB 연결 종료');
  } catch (error) {
    console.error('❌ MongoDB 연결 종료 실패:', error);
  }
};

export const getAllKeywords = async (): Promise<IKeyword[]> => {
  try {
    const keywords = await Keyword.find({});
    console.log(`✅ 총 ${keywords.length}개 키워드 로드`);
    return keywords;
  } catch (error) {
    console.error('❌ 키워드 로드 실패:', error);
    throw error;
  }
};

export const updateKeywordResult = async (
  keywordId: string,
  visibility: boolean,
  popularTopic: string,
  url: string
): Promise<void> => {
  try {
    await Keyword.findByIdAndUpdate(keywordId, {
      visibility,
      popularTopic,
      url,
      lastChecked: new Date(),
    });
    console.log(`✅ 키워드 업데이트 완료: ${keywordId}`);
  } catch (error) {
    console.error('❌ 키워드 업데이트 실패:', error);
    throw error;
  }
};
