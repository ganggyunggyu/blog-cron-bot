import mongoose, { Schema, Document } from 'mongoose';

export interface IKeyword extends Document {
  company: string;
  keyword: string;
  visibility: boolean;
  popularTopic: string;
  url: string;
  sheetType: string;
  lastChecked: Date;
  restaurantName?: string;
  matchedTitle?: string;
  matchedHtml?: string;
  postVendorName?: string;
  rank?: number;
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
    restaurantName: { type: String, default: '' },
    matchedTitle: { type: String, default: '' },
    matchedHtml: { type: String, default: '' },
    postVendorName: { type: String, default: '' },
    rank: { type: Number, default: 0 },
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
  url: string,
  restaurantName?: string,
  matchedTitle?: string,
  matchedHtml?: string,
  rank?: number,
  postVendorName?: string
): Promise<void> => {
  try {
    const update: Partial<IKeyword> = {
      visibility,
      popularTopic,
      url,
      lastChecked: new Date(),
    } as Partial<IKeyword>;

    if (typeof restaurantName !== 'undefined')
      update.restaurantName = restaurantName;
    if (typeof matchedTitle !== 'undefined') update.matchedTitle = matchedTitle;
    if (typeof matchedHtml !== 'undefined') update.matchedHtml = matchedHtml;
    if (typeof rank !== 'undefined') update.rank = rank;
    if (typeof postVendorName !== 'undefined')
      update.postVendorName = postVendorName;

    await Keyword.findByIdAndUpdate(keywordId, update);
  } catch (error) {
    console.error('❌ 키워드 업데이트 실패:', error);
    throw error;
  }
};
