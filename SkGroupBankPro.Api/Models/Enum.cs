namespace SkGroupBankpro.Api.Models
{
    public enum TxType
    {
        Deposit = 0,
        Withdrawal = 1,
        Rebate = 2,
        Bonus = 3,
        Adjustment = 4
    }

    public enum TxDirection
    {
        Credit,
        Debit
    }

    public enum TxStatus
    {
        Pending,
        Approved,
        Rejected,
        Completed
    }

   
}
