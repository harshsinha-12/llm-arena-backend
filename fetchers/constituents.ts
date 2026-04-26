import axios from 'axios'
import { CMOTS_INDEX_CONSTITUENTS } from "../config/global"
import { CmotsCode, MBCode } from "../types/global"
import { getCMOTSCodeFromMBCode, getMBCodeFromCmotsCode } from "../utils/codes"

export const getIndexConstituents = async (indexMBCode: MBCode): Promise<MBCode[]> => {
    try {
        const cmotsCode = (await getCMOTSCodeFromMBCode([indexMBCode]))[indexMBCode]
        const url = `${CMOTS_INDEX_CONSTITUENTS}${cmotsCode}`
        const response = await axios.get(url, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.CMOTS_TOKEN}`,
            },
            timeout: 5000,
        })
        const constituents = response?.data?.data ?? []
        const cmotsCodes = constituents.map((constituent: { CMOTSCode: CmotsCode }) => {
            return constituent.CMOTSCode
        })
        const mbCodesData = await getMBCodeFromCmotsCode(cmotsCodes)
        return cmotsCodes.map((cmotsCode: CmotsCode) => mbCodesData[cmotsCode])
    } catch (error) {
        throw new Error(`Failed to fetch constituents for indexCode ${indexMBCode}: ${error}`)
    }
}
