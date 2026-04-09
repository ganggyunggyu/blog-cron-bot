import mongoose, { Schema, Document } from 'mongoose';
import { logger } from './lib/logger';

export interface IKeyword extends Document {
  company: string;
  keyword: string;
  visibility: boolean;
  popularTopic: string;
  url: string;
  sheetType: string;
  keywordType: 'restaurant' | 'pet' | 'basic';
  lastChecked: Date;
  restaurantName?: string;
  matchedTitle?: string;
  postVendorName?: string;
  rank?: number;
  rankWithCafe?: number;
  isUpdateRequired?: boolean;
  isNewLogic?: boolean;
  foundPage?: number;
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
    keywordType: { type: String, enum: ['restaurant', 'pet', 'basic'], default: 'basic' },
    lastChecked: { type: Date, default: Date.now },
    restaurantName: { type: String, default: '' },
    matchedTitle: { type: String, default: '' },
    postVendorName: { type: String, default: '' },
    rank: { type: Number, default: 0 },
    rankWithCafe: { type: Number, default: 0 },
    isUpdateRequired: { type: Boolean, default: false },
    isNewLogic: { type: Boolean, default: false },
    foundPage: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

export const Keyword = mongoose.model<IKeyword>('Keyword', KeywordSchema);

export interface IRootKeyword extends Document {
  company: string;
  keyword: string;
  visibility: boolean;
  popularTopic: string;
  url: string;
  keywordType: 'restaurant' | 'pet' | 'basic';
  lastChecked: Date;
  restaurantName?: string;
  matchedTitle?: string;
  postVendorName?: string;
  rank?: number;
  rankWithCafe?: number;
  isUpdateRequired?: boolean;
  isNewLogic?: boolean;
  foundPage?: number;
  createdAt: Date;
  updatedAt: Date;
}

const RootKeywordSchema: Schema = new Schema(
  {
    company: { type: String, required: true },
    keyword: { type: String, required: true },
    visibility: { type: Boolean, default: false },
    popularTopic: { type: String, default: '' },
    url: { type: String, default: '' },
    keywordType: { type: String, enum: ['restaurant', 'pet', 'basic'], default: 'basic' },
    lastChecked: { type: Date, default: Date.now },
    restaurantName: { type: String, default: '' },
    matchedTitle: { type: String, default: '' },
    postVendorName: { type: String, default: '' },
    rank: { type: Number, default: 0 },
    rankWithCafe: { type: Number, default: 0 },
    isUpdateRequired: { type: Boolean, default: false },
    isNewLogic: { type: Boolean, default: false },
    foundPage: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

export const RootKeyword = mongoose.model<IRootKeyword>('RootKeyword', RootKeywordSchema);

export const connectDB = async (uri: string): Promise<void> => {
  try {
    await mongoose.connect(uri);
    logger.success('MongoDB 연결 성공');
  } catch (error) {
    logger.error(`MongoDB 연결 실패: ${(error as Error).message}`);
    throw error;
  }
};

export const disconnectDB = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    logger.success('MongoDB 연결 종료');
  } catch (error) {
    logger.error(`MongoDB 연결 종료 실패: ${(error as Error).message}`);
  }
};

export const getAllKeywords = async (): Promise<IKeyword[]> => {
  try {
    const keywords = await Keyword.find({});
    logger.success(`총 ${keywords.length}개 키워드 로드`);
    return keywords;
  } catch (error) {
    logger.error(`키워드 로드 실패: ${(error as Error).message}`);
    throw error;
  }
};

export const getAllRootKeywords = async (): Promise<IRootKeyword[]> => {
  try {
    const keywords = await RootKeyword.find({});
    logger.success(`총 ${keywords.length}개 루트 키워드 로드`);
    return keywords;
  } catch (error) {
    logger.error(`루트 키워드 로드 실패: ${(error as Error).message}`);
    throw error;
  }
};

export const updateKeywordResult = async (
  keywordId: string,
  visibility: boolean,
  popularTopic: string,
  url: string,
  keywordType: 'restaurant' | 'pet' | 'basic',
  restaurantName?: string,
  matchedTitle?: string,
  rank?: number,
  postVendorName?: string,
  rankWithCafe?: number,
  isUpdateRequired?: boolean,
  isNewLogic?: boolean,
  foundPage?: number
): Promise<void> => {
  try {
    const update: Partial<IKeyword> = {
      visibility,
      popularTopic,
      url,
      keywordType,
      lastChecked: new Date(),
    } as Partial<IKeyword>;

    if (typeof restaurantName !== 'undefined')
      update.restaurantName = restaurantName;
    if (typeof matchedTitle !== 'undefined') update.matchedTitle = matchedTitle;
    if (typeof rank !== 'undefined') update.rank = rank;
    if (typeof postVendorName !== 'undefined')
      update.postVendorName = postVendorName;
    if (typeof rankWithCafe !== 'undefined') update.rankWithCafe = rankWithCafe;
    if (typeof isUpdateRequired !== 'undefined')
      update.isUpdateRequired = isUpdateRequired;
    if (typeof isNewLogic !== 'undefined') update.isNewLogic = isNewLogic;
    if (typeof foundPage !== 'undefined') update.foundPage = foundPage;

    await Keyword.findByIdAndUpdate(keywordId, update);
  } catch (error) {
    logger.error(`키워드 업데이트 실패: ${(error as Error).message}`);
    throw error;
  }
};

export const updateRootKeywordResult = async (
  keywordId: string,
  visibility: boolean,
  popularTopic: string,
  url: string,
  keywordType: 'restaurant' | 'pet' | 'basic',
  restaurantName?: string,
  matchedTitle?: string,
  rank?: number,
  postVendorName?: string,
  rankWithCafe?: number,
  isUpdateRequired?: boolean,
  isNewLogic?: boolean,
  foundPage?: number
): Promise<void> => {
  try {
    const update: Partial<IRootKeyword> = {
      visibility,
      popularTopic,
      url,
      keywordType,
      lastChecked: new Date(),
    } as Partial<IRootKeyword>;

    if (typeof restaurantName !== 'undefined')
      update.restaurantName = restaurantName;
    if (typeof matchedTitle !== 'undefined') update.matchedTitle = matchedTitle;
    if (typeof rank !== 'undefined') update.rank = rank;
    if (typeof postVendorName !== 'undefined')
      update.postVendorName = postVendorName;
    if (typeof rankWithCafe !== 'undefined') update.rankWithCafe = rankWithCafe;
    if (typeof isUpdateRequired !== 'undefined')
      update.isUpdateRequired = isUpdateRequired;
    if (typeof isNewLogic !== 'undefined') update.isNewLogic = isNewLogic;
    if (typeof foundPage !== 'undefined') update.foundPage = foundPage;

    await RootKeyword.findByIdAndUpdate(keywordId, update);
  } catch (error) {
    logger.error(`루트 키워드 업데이트 실패: ${(error as Error).message}`);
    throw error;
  }
};

// ===== Page Check 컬렉션 (eye-clinic, diet, health-food, pet) =====

export interface IPageCheckKeyword extends Document {
  company: string;
  keyword: string;
  visibility: boolean;
  popularTopic: string;
  url: string;
  keywordType: 'restaurant' | 'pet' | 'basic';
  lastChecked: Date;
  restaurantName?: string;
  matchedTitle?: string;
  postVendorName?: string;
  rank?: number;
  rankWithCafe?: number;
  isUpdateRequired?: boolean;
  isNewLogic?: boolean;
  foundPage?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PageCheckKeywordInput {
  company: string;
  keyword: string;
  visibility?: boolean;
  popularTopic?: string;
  url?: string;
  keywordType?: 'restaurant' | 'pet' | 'basic';
  restaurantName?: string;
  matchedTitle?: string;
  postVendorName?: string;
  rank?: number;
  rankWithCafe?: number;
  isUpdateRequired?: boolean;
  isNewLogic?: boolean;
  foundPage?: number;
}

const PageCheckKeywordSchema: Schema = new Schema(
  {
    company: { type: String, required: true },
    keyword: { type: String, required: true },
    visibility: { type: Boolean, default: false },
    popularTopic: { type: String, default: '' },
    url: { type: String, default: '' },
    keywordType: {
      type: String,
      enum: ['restaurant', 'pet', 'basic'],
      default: 'basic',
    },
    lastChecked: { type: Date, default: Date.now },
    restaurantName: { type: String, default: '' },
    matchedTitle: { type: String, default: '' },
    postVendorName: { type: String, default: '' },
    rank: { type: Number, default: 0 },
    rankWithCafe: { type: Number, default: 0 },
    isUpdateRequired: { type: Boolean, default: false },
    isNewLogic: { type: Boolean, default: false },
    foundPage: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

export type PageCheckSheetType =
  | 'black-goat-new'
  | 'black-goat-old'
  | 'diet-supplement'
  | 'skin-procedure'
  | 'prescription'
  | 'dental'
  | 'eye-clinic'
  | 'pet'
  | 'suripet';

const pageCheckModels: Record<
  PageCheckSheetType,
  mongoose.Model<IPageCheckKeyword>
> = {
  'black-goat-new': mongoose.model<IPageCheckKeyword>(
    'blackgoatnews',
    PageCheckKeywordSchema,
    'blackgoatnews'
  ),
  'black-goat-old': mongoose.model<IPageCheckKeyword>(
    'blackgoatolds',
    PageCheckKeywordSchema,
    'blackgoatolds'
  ),
  'diet-supplement': mongoose.model<IPageCheckKeyword>(
    'dietsupplements',
    PageCheckKeywordSchema,
    'dietsupplements'
  ),
  'skin-procedure': mongoose.model<IPageCheckKeyword>(
    'skinprocedures',
    PageCheckKeywordSchema,
    'skinprocedures'
  ),
  prescription: mongoose.model<IPageCheckKeyword>(
    'prescriptions',
    PageCheckKeywordSchema,
    'prescriptions'
  ),
  dental: mongoose.model<IPageCheckKeyword>(
    'dentals',
    PageCheckKeywordSchema,
    'dentals'
  ),
  'eye-clinic': mongoose.model<IPageCheckKeyword>(
    'eyeclinics',
    PageCheckKeywordSchema,
    'eyeclinics'
  ),
  pet: mongoose.model<IPageCheckKeyword>('pets', PageCheckKeywordSchema, 'pets'),
  suripet: mongoose.model<IPageCheckKeyword>(
    'suripetKeywords',
    PageCheckKeywordSchema,
    'suripetKeywords'
  ),
};

export const getPageCheckKeywords = async (
  sheetType: PageCheckSheetType
): Promise<IPageCheckKeyword[]> => {
  try {
    const model = pageCheckModels[sheetType];
    const keywords = await model.find({});
    return keywords;
  } catch (error) {
    logger.error(
      `${sheetType} 키워드 로드 실패: ${(error as Error).message}`
    );
    throw error;
  }
};

export const replacePageCheckKeywords = async (
  sheetType: PageCheckSheetType,
  keywords: PageCheckKeywordInput[]
): Promise<number> => {
  try {
    const model = pageCheckModels[sheetType];
    const existingKeywords = await model
      .find({})
      .lean<PageCheckKeywordInput[]>();

    const restoreKeywords = existingKeywords.map(
      ({
        company,
        keyword,
        visibility,
        popularTopic,
        url,
        keywordType,
        restaurantName,
        matchedTitle,
        postVendorName,
        rank,
        rankWithCafe,
        isUpdateRequired,
        isNewLogic,
        foundPage,
      }) => ({
        company,
        keyword,
        visibility,
        popularTopic,
        url,
        keywordType,
        restaurantName,
        matchedTitle,
        postVendorName,
        rank,
        rankWithCafe,
        isUpdateRequired,
        isNewLogic,
        foundPage,
      })
    );

    await model.deleteMany({});

    if (keywords.length === 0) {
      return 0;
    }

    try {
      await model.insertMany(keywords);
    } catch (error) {
      if (restoreKeywords.length > 0) {
        await model.insertMany(restoreKeywords);
      }

      throw error;
    }

    return keywords.length;
  } catch (error) {
    logger.error(
      `${sheetType} 키워드 동기화 실패: ${(error as Error).message}`
    );
    throw error;
  }
};

export const updatePageCheckKeywordResult = async (
  sheetType: PageCheckSheetType,
  keywordId: string,
  visibility: boolean,
  popularTopic: string,
  url: string,
  keywordType: 'restaurant' | 'pet' | 'basic',
  restaurantName?: string,
  matchedTitle?: string,
  rank?: number,
  postVendorName?: string,
  rankWithCafe?: number,
  isUpdateRequired?: boolean,
  isNewLogic?: boolean,
  foundPage?: number
): Promise<void> => {
  try {
    const model = pageCheckModels[sheetType];
    const update: Partial<IPageCheckKeyword> = {
      visibility,
      popularTopic,
      url,
      keywordType,
      lastChecked: new Date(),
    } as Partial<IPageCheckKeyword>;

    if (typeof restaurantName !== 'undefined')
      update.restaurantName = restaurantName;
    if (typeof matchedTitle !== 'undefined') update.matchedTitle = matchedTitle;
    if (typeof rank !== 'undefined') update.rank = rank;
    if (typeof postVendorName !== 'undefined')
      update.postVendorName = postVendorName;
    if (typeof rankWithCafe !== 'undefined') update.rankWithCafe = rankWithCafe;
    if (typeof isUpdateRequired !== 'undefined')
      update.isUpdateRequired = isUpdateRequired;
    if (typeof isNewLogic !== 'undefined') update.isNewLogic = isNewLogic;
    if (typeof foundPage !== 'undefined') update.foundPage = foundPage;

    await model.findByIdAndUpdate(keywordId, update);
  } catch (error) {
    logger.error(
      `${sheetType} 키워드 업데이트 실패: ${(error as Error).message}`
    );
    throw error;
  }
};

export interface IExposureHistorySnapshot extends Document {
  runId: string;
  source: string;
  sheetId: string;
  tabName: string;
  targetType: string;
  sheetType: string;
  sheetRowNumber: number;
  orderIndex: number;
  company: string;
  keyword: string;
  visibility: boolean;
  popularTopic: string;
  url: string;
  keywordType: 'restaurant' | 'pet' | 'basic';
  restaurantName?: string;
  matchedTitle?: string;
  postVendorName?: string;
  rank?: number;
  rankWithCafe?: number;
  isUpdateRequired?: boolean;
  isNewLogic?: boolean;
  foundPage?: number;
  checkedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExposureHistorySnapshotInput {
  runId: string;
  source: string;
  sheetId: string;
  tabName: string;
  targetType: string;
  sheetType: string;
  sheetRowNumber: number;
  orderIndex: number;
  company: string;
  keyword: string;
  visibility: boolean;
  popularTopic: string;
  url: string;
  keywordType: 'restaurant' | 'pet' | 'basic';
  restaurantName?: string;
  matchedTitle?: string;
  postVendorName?: string;
  rank?: number;
  rankWithCafe?: number;
  isUpdateRequired?: boolean;
  isNewLogic?: boolean;
  foundPage?: number;
}

const ExposureHistorySnapshotSchema: Schema = new Schema(
  {
    runId: { type: String, required: true },
    source: { type: String, required: true },
    sheetId: { type: String, required: true },
    tabName: { type: String, required: true },
    targetType: { type: String, required: true },
    sheetType: { type: String, required: true },
    sheetRowNumber: { type: Number, required: true },
    orderIndex: { type: Number, required: true },
    company: { type: String, default: '' },
    keyword: { type: String, required: true },
    visibility: { type: Boolean, default: false },
    popularTopic: { type: String, default: '' },
    url: { type: String, default: '' },
    keywordType: {
      type: String,
      enum: ['restaurant', 'pet', 'basic'],
      default: 'basic',
    },
    restaurantName: { type: String, default: '' },
    matchedTitle: { type: String, default: '' },
    postVendorName: { type: String, default: '' },
    rank: { type: Number, default: 0 },
    rankWithCafe: { type: Number, default: 0 },
    isUpdateRequired: { type: Boolean, default: false },
    isNewLogic: { type: Boolean, default: false },
    foundPage: { type: Number, default: 0 },
    checkedAt: { type: Date, required: true },
  },
  {
    timestamps: true,
  }
);

const getHistoryCollectionParts = (
  checkedAt: Date
): { collectionName: string; modelName: string } => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter
    .formatToParts(checkedAt)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== 'literal') {
        acc[part.type] = part.value;
      }

      return acc;
    }, {});

  const dateKey = `${parts.year}_${parts.month}_${parts.day}`;

  return {
    collectionName: `exposure_history_${dateKey}`,
    modelName: `ExposureHistory_${dateKey}`,
  };
};

const getExposureHistoryModel = (
  checkedAt: Date
): mongoose.Model<IExposureHistorySnapshot> => {
  const { collectionName, modelName } = getHistoryCollectionParts(checkedAt);

  if (mongoose.models[modelName]) {
    return mongoose.models[modelName] as mongoose.Model<IExposureHistorySnapshot>;
  }

  return mongoose.model<IExposureHistorySnapshot>(
    modelName,
    ExposureHistorySnapshotSchema,
    collectionName
  );
};

export const saveExposureHistorySnapshots = async (
  checkedAt: Date,
  snapshots: ExposureHistorySnapshotInput[]
): Promise<{ inserted: number; collectionName: string }> => {
  if (snapshots.length === 0) {
    const { collectionName } = getHistoryCollectionParts(checkedAt);

    return {
      inserted: 0,
      collectionName,
    };
  }

  try {
    const model = getExposureHistoryModel(checkedAt);
    const docs = snapshots.map((snapshot) => ({
      ...snapshot,
      checkedAt,
    }));

    await model.insertMany(docs, {
      ordered: false,
    });

    return {
      inserted: docs.length,
      collectionName: model.collection.collectionName,
    };
  } catch (error) {
    logger.error(
      `노출 히스토리 저장 실패: ${(error as Error).message}`
    );
    throw error;
  }
};
