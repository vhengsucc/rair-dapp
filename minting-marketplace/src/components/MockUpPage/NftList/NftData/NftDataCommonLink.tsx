import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import axios, { AxiosError } from 'axios';
import { BigNumber, utils } from 'ethers';

import { NftCollectionPage } from './NftCollectionPage';
import NftDataPageMain from './NftDataPageMain';
import NftUnlockablesPage from './NftUnlockablesPage';

import {
  IOffersResponseType,
  TFileType,
  TMetadataType,
  TNftFilesResponse,
  TNftItemResponse,
  TProducts,
  TTokenData,
  TUserResponse
} from '../../../../axios.responseTypes';
import { RootState } from '../../../../ducks';
import { ColorStoreType } from '../../../../ducks/colors/colorStore.types';
import { setRealChain } from '../../../../ducks/contracts/actions';
import { ContractsInitialType } from '../../../../ducks/contracts/contracts.types';
import {
  setTokenData,
  setTokenDataStart
} from '../../../../ducks/nftData/action';
import { UserType } from '../../../../ducks/users/users.types';
import useConnectUser from '../../../../hooks/useConnectUser';
import { TOfferType } from '../../../marketplace/marketplace.types';
import {
  INftDataCommonLinkComponent,
  TParamsNftDataCommonLink
} from '../nftList.types';

const NftDataCommonLinkComponent: React.FC<INftDataCommonLinkComponent> = ({
  embeddedParams,
  tokenNumber,
  setTokenNumber
}) => {
  const [collectionName, setCollectionName] = useState<string>();
  const [tokenDataFiltered, setTokenDataFiltered] = useState<TTokenData[]>([]);
  const [totalCount, setTotalCount] = useState<number>();
  const [selectedData, setSelectedData] = useState<TMetadataType>();
  const [selectedOfferIndex, setSelectedOfferIndex] = useState<string>();
  const [selectedToken, setSelectedToken] = useState<string>();
  const [offerPrice, setOfferPrice] = useState<string[] | undefined>([]);
  const [offerData, setOfferData] = useState<TOfferType>();
  const [offerDataInfo, setOfferDataInfo] = useState<TOfferType[]>();
  const [ownerInfo, setOwnerInfo] = useState<TProducts>();
  const [productsFromOffer, setProductsFromOffer] = useState<TFileType[]>([]);
  const [showToken, setShowToken] = useState<number>(15);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [someUsersData, setSomeUsersData] = useState<UserType | null>();
  const [dataForUser, setDataForUser] = useState<TProducts>();
  const [tokenBought, setTokenBought] = useState<boolean>(false);
  const showTokensRef = useRef<number>(20);
  const [renderOffers, setRenderOffers] = useState<boolean>(false);

  const dispatch = useDispatch();
  const { currentUserAddress } = useSelector<RootState, ContractsInitialType>(
    (store) => store.contractStore
  );
  const { primaryColor, textColor } = useSelector<RootState, ColorStoreType>(
    (store) => store.colorStore
  );
  const tokenData = useSelector<
    RootState,
    { [index: string]: TTokenData } | null | undefined
  >((state) => state.nftDataStore.tokenData);

  const navigate = useNavigate();
  const params = useParams<TParamsNftDataCommonLink>();
  const { pathname } = useLocation();

  const mode = embeddedParams
    ? embeddedParams.mode
    : pathname?.split('/')?.at(1);

  const { contract, product, tokenId, blockchain } = embeddedParams
    ? embeddedParams
    : params;

  const getAllProduct = useCallback(
    async (fromToken: string, toToken: string) => {
      setIsLoading(true);
      const responseAllProduct = await axios.get<TNftItemResponse>(
        `/api/nft/network/${blockchain}/${contract}/${product}?fromToken=${fromToken}&toToken=${toToken}`
      );

      const tokenMapping = {};

      if (responseAllProduct.data.success && responseAllProduct.data.result) {
        responseAllProduct.data.result.tokens.forEach((item) => {
          tokenMapping[item.token] = item;
        });
      }

      dispatch(setTokenData(tokenMapping));
      setTotalCount(responseAllProduct.data.result.totalCount);
      setIsLoading(false);

      if (tokenId && tokenMapping[tokenId]) {
        setSelectedData(tokenMapping[tokenId]?.metadata);
        setIsLoading(false);
      }

      setSelectedToken(tokenId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [product, contract, tokenId, blockchain, dispatch, tokenBought]
  );

  const getProductsFromOffer = useCallback(async () => {
    setIsLoading(true);
    const response = await axios.get<TNftFilesResponse>(
      `/api/nft/network/${blockchain}/${contract}/${product}/files`
    );
    setIsLoading(false);
    const loadedFiles: string[] = [];
    setProductsFromOffer(
      response.data.files.filter((item: TFileType) => {
        if (!loadedFiles.includes(item._id)) {
          loadedFiles.push(item._id);
          return true;
        }
        return false;
      })
    );
    if (tokenData && tokenId) {
      if (tokenData[tokenId]?.offer?.diamond) {
        setSelectedOfferIndex(
          tokenData && tokenData[tokenId]?.offer?.diamondRangeIndex
        );
      } else {
        setSelectedOfferIndex(
          tokenData && tokenData[tokenId]?.offer?.offerIndex
        );
      }
    }
  }, [blockchain, contract, product, tokenId, tokenData]);

  const getParticularOffer = useCallback(async () => {
    try {
      const response = await axios.get<IOffersResponseType>(
        `/api/nft/network/${blockchain}/${contract}/${product}/offers`
      );

      if (response.data.success) {
        setDataForUser(response.data.product);
        setOfferData(
          response.data.product.offers?.find((neededOfferIndex) => {
            if (neededOfferIndex && neededOfferIndex.diamond) {
              return neededOfferIndex.diamondRangeIndex === selectedOfferIndex;
            } else {
              return neededOfferIndex.offerIndex === selectedOfferIndex;
            }
          })
        );

        setOfferPrice(
          response.data.product.offers?.map((p) => {
            return p.price.toString();
          })
        );

        setOwnerInfo(response.data.product);
        setOfferDataInfo(response.data.product.offers);
        setCollectionName(response.data.product.name);
      }
    } catch (err) {
      const error = err as AxiosError;
      console.error(error?.message);
    }
  }, [product, contract, selectedOfferIndex, blockchain]);

  const neededUserAddress = dataForUser?.owner;

  const getInfoFromUser = useCallback(async () => {
    // find user
    if (neededUserAddress && utils.isAddress(neededUserAddress)) {
      const result = await axios
        .get<TUserResponse>(`/api/users/${neededUserAddress}`)
        .then((res) => res.data);
      setSomeUsersData(result.user);
    }
  }, [neededUserAddress]);

  const handleTokenBoughtButton = useCallback(() => {
    setTokenBought((prev) => !prev);
  }, [setTokenBought]);

  useEffect(() => {
    getInfoFromUser();
  }, [getInfoFromUser]);

  //unused-snippet
  // const onSelect = useCallback(
  //   (id: string) => {
  //     tokenData?.forEach((p) => {
  //       if (p._id === id) {
  //         setSelectedData(p.metadata);
  //       }
  //     });
  //   },
  //   [tokenData]
  // );

  const handleClickToken = async (tokenId: string | undefined) => {
    if (embeddedParams && tokenId) {
      embeddedParams.setTokenId(tokenId);
    } else {
      navigate(`/tokens/${blockchain}/${contract}/${product}/${tokenId}`);
    }

    if (
      tokenData &&
      tokenId &&
      Object.keys(tokenData).length >= Number(tokenId)
    ) {
      setSelectedData(
        tokenData && tokenData[tokenId] && tokenData[tokenId].metadata
      );
    }

    setSelectedToken(tokenId);
  };

  useEffect(() => {
    dispatch(setTokenDataStart());
  }, [dispatch]);

  useEffect(() => {
    dispatch(setRealChain(blockchain));
  }, [blockchain, dispatch]);

  useEffect(() => {
    let tokenStart = BigNumber.from(0);
    let tokenEnd = BigNumber.from(15);
    if (tokenId) {
      tokenStart = BigNumber.from(tokenId).sub(10);
      if (tokenStart.lt(0)) {
        tokenStart = BigNumber.from(0);
      }
      if (tokenNumber && tokenNumber > 20) {
        tokenEnd = BigNumber.from(tokenNumber);
      } else {
        tokenEnd = tokenStart.add(showTokensRef.current);
        setTokenNumber(undefined);
      }
    }
    getAllProduct(tokenStart.toString(), tokenEnd.toString());
  }, [getAllProduct, showTokensRef, tokenId, tokenNumber, setTokenNumber]);

  useEffect(() => {
    getParticularOffer();
  }, [getParticularOffer, renderOffers]);

  useEffect(() => {
    getProductsFromOffer();
  }, [getProductsFromOffer]);

  useEffect(() => {
    showTokensRef.current = 20;
  }, []);

  useEffect(() => {
    if (tokenData === undefined || !tokenData) {
      setTokenNumber(undefined);
    }
  }, [tokenData]);

  useEffect(() => {
    return () => {
      setTokenNumber(undefined);
    };
  }, []);

  if (mode === 'collection') {
    return (
      <NftCollectionPage
        embeddedParams={embeddedParams}
        blockchain={blockchain}
        offerPrice={offerPrice}
        someUsersData={someUsersData}
        selectedData={selectedData}
        tokenData={tokenData}
        tokenDataFiltered={tokenDataFiltered}
        totalCount={totalCount}
        getAllProduct={getAllProduct}
        setShowToken={setShowToken}
        showToken={showToken}
        isLoading={isLoading}
        setTokenDataFiltered={setTokenDataFiltered}
        offerDataCol={offerDataInfo}
        offerAllData={ownerInfo}
        collectionName={collectionName}
        showTokensRef={showTokensRef}
        setRenderOffers={setRenderOffers}
        tokenNumber={tokenNumber}
      />
    );
  } else if (mode === 'unlockables') {
    return (
      <NftUnlockablesPage
        embeddedParams={embeddedParams}
        primaryColor={primaryColor}
        productsFromOffer={productsFromOffer}
        selectedToken={selectedToken}
        tokenData={tokenData}
        setTokenDataFiltered={setTokenDataFiltered}
        someUsersData={someUsersData}
        collectionName={collectionName}
      />
    );
  } else if (mode === 'tokens') {
    return (
      <NftDataPageMain
        embeddedParams={embeddedParams}
        blockchain={blockchain}
        contract={contract}
        currentUser={currentUserAddress}
        handleClickToken={handleClickToken}
        offerData={offerData}
        offerPrice={offerPrice}
        primaryColor={primaryColor}
        productsFromOffer={productsFromOffer}
        setSelectedToken={setSelectedToken}
        someUsersData={someUsersData}
        selectedData={selectedData}
        selectedToken={selectedToken}
        textColor={textColor}
        totalCount={totalCount}
        product={product}
        ownerInfo={ownerInfo}
        offerDataInfo={offerDataInfo}
        handleTokenBoughtButton={handleTokenBoughtButton}
        setTokenNumber={setTokenNumber}
      />
    );
  } else {
    return <></>;
  }
};

export const NftDataCommonLink = memo(NftDataCommonLinkComponent);
